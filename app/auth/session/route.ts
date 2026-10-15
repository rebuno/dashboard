import type { NextRequest } from "next/server";
import { oidcEnabled, readSession } from "@/lib/auth";

export function GET(req: NextRequest) {
  return Response.json({
    enabled: oidcEnabled(),
    user: readSession(req)?.user ?? null,
  });
}
