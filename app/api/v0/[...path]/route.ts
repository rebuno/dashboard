import { NextRequest, NextResponse } from "next/server";

const REBUNO_URL = process.env.REBUNO_URL || "http://localhost:8080";
const REBUNO_API_KEY = process.env.REBUNO_API_KEY || "";

async function proxy(req: NextRequest) {
  const url = new URL(req.url);

  if (!url.pathname.startsWith("/api/v0/") || url.pathname.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const kernelPath = url.pathname.replace(/^\/api/, "");
  const target = `${REBUNO_URL}${kernelPath}${url.search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("Content-Type");
  if (contentType) headers["Content-Type"] = contentType;
  if (REBUNO_API_KEY) headers["Authorization"] = `Bearer ${REBUNO_API_KEY}`;

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  try {
    const resp = await fetch(target, init);
    const data = await resp.arrayBuffer();
    // Null-body statuses (204/205/304) cannot be constructed with a body —
    // Response/NextResponse throws even for an empty ArrayBuffer — so every
    // kernel 204 (cancel, delete, grant/deny, load-policy) would otherwise
    // throw here and get masked as a 502 by the catch below.
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
