import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";

const ISSUER = process.env.OIDC_ISSUER || "";
const CLIENT_ID = process.env.OIDC_CLIENT_ID || "";
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || "";
const SCOPES = process.env.OIDC_SCOPES || "openid email profile offline_access";
const FORWARD = process.env.OIDC_FORWARD_TOKEN === "access" ? "access" : "id";
const DASHBOARD_URL = (process.env.DASHBOARD_URL || "").replace(/\/+$/, "");
const SESSION_SECRET = process.env.SESSION_SECRET || "";

export const SESSION_COOKIE = "rebuno_session";
const LOGIN_COOKIE = "rebuno_login";
const CHUNK_SIZE = 3800;
const REFRESH_LEEWAY_SECONDS = 60;

export function oidcEnabled(): boolean {
  return ISSUER !== "";
}

export function checkConfig(): string | null {
  const missing = [
    ["OIDC_CLIENT_ID", CLIENT_ID],
    ["DASHBOARD_URL", DASHBOARD_URL],
    ["SESSION_SECRET", SESSION_SECRET],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) return `OIDC_ISSUER requires ${missing.join(", ")}`;
  if (SESSION_SECRET.length < 32)
    return "SESSION_SECRET must be at least 32 characters";
  return null;
}

export interface Session {
  token: string;
  exp: number;
  user: string;
  refresh?: string;
  id?: string;
}

interface LoginState {
  verifier: string;
  state: string;
  nonce: string;
  returnTo: string;
}

function key(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function seal(value: unknown, secret = SESSION_SECRET): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(sealed: string, secret = SESSION_SECRET): T | null {
  try {
    const raw = Buffer.from(sealed, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(secret),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    const body = Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]);
    return JSON.parse(body.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function chunk(value: string, size = CHUNK_SIZE): string[] {
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size)
    out.push(value.slice(i, i + size));
  return out;
}

export function safeReturnTo(path: string | null): string {
  if (!path || !path.startsWith("/") || /^\/[/\\]/.test(path)) return "/";
  return path;
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: DASHBOARD_URL.startsWith("https:"),
  path: "/",
});

function chunkNames(req: NextRequest): string[] {
  return req.cookies
    .getAll()
    .map((c) => c.name)
    .filter((n) => n.startsWith(`${SESSION_COOKIE}.`));
}

export function readSession(req: NextRequest): Session | null {
  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const part = req.cookies.get(`${SESSION_COOKIE}.${i}`)?.value;
    if (part === undefined) break;
    parts.push(part);
  }
  return parts.length ? unseal<Session>(parts.join("")) : null;
}

export function writeSession(
  req: NextRequest,
  res: NextResponse,
  session: Session | null,
) {
  const parts = session ? chunk(seal(session)) : [];
  parts.forEach((part, i) => {
    res.cookies.set(`${SESSION_COOKIE}.${i}`, part, cookieOptions());
  });
  for (const name of chunkNames(req)) {
    if (Number(name.slice(SESSION_COOKIE.length + 1)) >= parts.length)
      res.cookies.set(name, "", { ...cookieOptions(), maxAge: 0 });
  }
}

let configPromise: Promise<oidc.Configuration> | null = null;

function config(): Promise<oidc.Configuration> {
  configPromise ??= oidc
    .discovery(
      new URL(ISSUER),
      CLIENT_ID,
      CLIENT_SECRET || undefined,
      CLIENT_SECRET ? undefined : oidc.None(),
      ISSUER.startsWith("http:")
        ? { execute: [oidc.allowInsecureRequests] }
        : undefined,
    )
    .catch((err) => {
      configPromise = null;
      throw err;
    });
  return configPromise;
}

const redirectUri = () => `${DASHBOARD_URL}/auth/callback`;

export async function beginLogin(
  returnTo: string | null,
): Promise<NextResponse> {
  const cfg = await config();
  const login: LoginState = {
    verifier: oidc.randomPKCECodeVerifier(),
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    returnTo: safeReturnTo(returnTo),
  };
  const url = oidc.buildAuthorizationUrl(cfg, {
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge: await oidc.calculatePKCECodeChallenge(login.verifier),
    code_challenge_method: "S256",
    state: login.state,
    nonce: login.nonce,
  });
  const out = NextResponse.redirect(url);
  out.cookies.set(LOGIN_COOKIE, seal(login), {
    ...cookieOptions(),
    maxAge: 600,
  });
  return out;
}

function toSession(
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  previous?: Session,
): Session | null {
  const claims = tokens.claims();
  const user =
    (claims &&
      String(claims.email ?? claims.preferred_username ?? claims.sub)) ||
    previous?.user ||
    "";
  const refresh = tokens.refresh_token ?? previous?.refresh;
  if (FORWARD === "id") {
    if (!tokens.id_token || !claims) return null;
    return { token: tokens.id_token, exp: claims.exp, user, refresh };
  }
  const expiresIn = tokens.expiresIn();
  return {
    token: tokens.access_token,
    exp: Math.floor(Date.now() / 1000) + (expiresIn ?? 300),
    user,
    refresh,
    id: tokens.id_token ?? previous?.id,
  };
}

export async function completeLogin(
  req: NextRequest,
): Promise<{ session: Session; returnTo: string }> {
  const sealed = req.cookies.get(LOGIN_COOKIE)?.value;
  const login = sealed ? unseal<LoginState>(sealed) : null;
  if (!login) throw new Error("Sign-in expired. Start again.");
  const callback = new URL(redirectUri());
  callback.search = req.nextUrl.search;
  const tokens = await oidc.authorizationCodeGrant(await config(), callback, {
    pkceCodeVerifier: login.verifier,
    expectedState: login.state,
    expectedNonce: login.nonce,
    idTokenExpected: FORWARD === "id",
  });
  const session = toSession(tokens);
  if (!session) throw new Error("The identity provider returned no ID token.");
  return { session, returnTo: login.returnTo };
}

export function clearLogin(res: NextResponse) {
  res.cookies.set(LOGIN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

const refreshing = new Map<string, Promise<Session | null>>();

function refresh(session: Session): Promise<Session | null> {
  const token = session.refresh as string;
  let pending = refreshing.get(token);
  if (!pending) {
    pending = config()
      .then((cfg) => oidc.refreshTokenGrant(cfg, token))
      .then((tokens) => toSession(tokens, session))
      .catch((err) => {
        console.error("OIDC token refresh failed", err);
        return null;
      })
      .finally(() => refreshing.delete(token));
    refreshing.set(token, pending);
  }
  return pending;
}

export async function currentSession(
  req: NextRequest,
): Promise<{ session: Session | null; changed: boolean }> {
  const session = readSession(req);
  if (!session) return { session: null, changed: false };
  if (session.exp - Date.now() / 1000 > REFRESH_LEEWAY_SECONDS)
    return { session, changed: false };
  if (!session.refresh) return { session: null, changed: true };
  return { session: await refresh(session), changed: true };
}

export async function logoutUrl(session: Session | null): Promise<string> {
  const home = `${DASHBOARD_URL}/`;
  try {
    const cfg = await config();
    if (!cfg.serverMetadata().end_session_endpoint) return home;
    const params: Record<string, string> = { post_logout_redirect_uri: home };
    const hint = session && (FORWARD === "id" ? session.token : session.id);
    if (hint) params.id_token_hint = hint;
    return oidc.buildEndSessionUrl(cfg, params).href;
  } catch {
    return home;
  }
}

export function sameOrigin(req: NextRequest): boolean {
  return req.headers.get("origin") === new URL(DASHBOARD_URL).origin;
}

export function loginRequired(): NextResponse {
  return NextResponse.json(
    { code: "login_required", message: "Sign in to continue" },
    { status: 401 },
  );
}
