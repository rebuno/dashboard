import { type NextRequest, NextResponse } from "next/server";
import { logoutUrl, readSession, writeSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(await logoutUrl(readSession(req)), 303);
  writeSession(req, res, null);
  return res;
}
