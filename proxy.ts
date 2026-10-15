import { type NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  if (!process.env.OIDC_ISSUER || req.cookies.has("rebuno_session.0"))
    return NextResponse.next();
  const login = new URL("/auth/login", req.url);
  login.searchParams.set("return", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api|auth|_next|.*\\..*).*)"],
};
