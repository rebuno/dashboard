import { type NextRequest, NextResponse } from "next/server";
import { clearLogin, completeLogin, writeSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { session, returnTo } = await completeLogin(req);
    const res = new NextResponse(null, {
      status: 303,
      headers: { Location: returnTo },
    });
    writeSession(req, res, session);
    clearLogin(res);
    return res;
  } catch (err) {
    console.error("OIDC sign-in failed", err);
    const res = new NextResponse(
      `Sign-in failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 400 },
    );
    clearLogin(res);
    return res;
  }
}
