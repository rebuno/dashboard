import { NextRequest, NextResponse } from "next/server";

const KERNEL_URL = process.env.KERNEL_URL || "http://localhost:8080";
const KERNEL_API_KEY = process.env.KERNEL_API_KEY || "";

export async function GET(_req: NextRequest) {
  const headers: Record<string, string> = {};
  if (KERNEL_API_KEY) headers["Authorization"] = `Bearer ${KERNEL_API_KEY}`;

  try {
    const resp = await fetch(`${KERNEL_URL}/metrics`, { headers });
    const text = await resp.text();
    return new NextResponse(text, {
      status: resp.status,
      headers: { "Content-Type": resp.headers.get("Content-Type") || "text/plain" },
    });
  } catch (err) {
    console.error("Failed to proxy /metrics", err);
    return NextResponse.json({ error: "Kernel unavailable" }, { status: 502 });
  }
}
