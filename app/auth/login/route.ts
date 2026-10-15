import type { NextRequest } from "next/server";
import { beginLogin, checkConfig, oidcEnabled } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!oidcEnabled())
    return new Response(null, { status: 303, headers: { Location: "/" } });
  const problem = checkConfig();
  if (problem) return new Response(problem, { status: 500 });
  try {
    return await beginLogin(req.nextUrl.searchParams.get("return"));
  } catch (err) {
    console.error("OIDC discovery failed", err);
    return new Response("The identity provider is unavailable.", {
      status: 502,
    });
  }
}
