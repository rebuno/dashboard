import { NextRequest, NextResponse } from "next/server";
import {
  currentSession,
  loginRequired,
  oidcEnabled,
  type Session,
  sameOrigin,
  writeSession,
} from "@/lib/auth";

const REBUNO_URL = process.env.REBUNO_URL || "http://localhost:8080";
const REBUNO_API_KEY = process.env.REBUNO_API_KEY || "";

async function proxy(req: NextRequest) {
  if (!oidcEnabled()) return forward(req, REBUNO_API_KEY);
  if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) {
    return NextResponse.json(
      { error: "Cross-origin request" },
      { status: 403 },
    );
  }
  const { session, changed } = await currentSession(req);
  const res = session ? await forward(req, session.token) : loginRequired();
  if (changed) writeSession(req, res, session as Session | null);
  return res;
}

async function forward(req: NextRequest, token: string) {
  const url = new URL(req.url);

  if (!url.pathname.startsWith("/api/v0/") || url.pathname.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const kernelPath = url.pathname.replace(/^\/api/, "");
  const target = `${REBUNO_URL}${kernelPath}${url.search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("Content-Type");
  if (contentType) headers["Content-Type"] = contentType;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  try {
    const resp = await fetch(target, init);
    const data = await resp.arrayBuffer();
    // NextResponse throws on a null-body status given any body, even an empty
    // ArrayBuffer, which the catch below would then mask as a 502.
    if (resp.status === 204 || resp.status === 205 || resp.status === 304) {
      return new NextResponse(null, { status: resp.status });
    }
    return new NextResponse(data, {
      status: resp.status,
      headers: {
        "Content-Type": resp.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    console.error(`Failed to proxy ${target}`, err);
    return NextResponse.json({ error: "Kernel unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
