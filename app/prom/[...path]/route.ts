import { NextRequest, NextResponse } from "next/server";
import {
  ensureScraping,
  instantQuery,
  rangeQuery,
  rateQuery,
  histogramQuantileQuery,
} from "@/lib/metrics-store";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "";

function promResponse(data: unknown) {
  return NextResponse.json({ status: "success", data });
}

function parsePromQL(query: string) {
  let match = query.match(/^rate\((\w+)\[[\w]+\]\)$/);
  if (match) return { type: "rate" as const, metric: match[1] };

  match = query.match(
    /^histogram_quantile\(([\d.]+),\s*rate\((\w+)_bucket\[[\w]+\]\)\)$/
  );
  if (match)
    return {
      type: "histogram_quantile" as const,
      quantile: parseFloat(match[1]),
      metric: match[2],
    };

  return { type: "instant" as const, metric: query.trim() };
}

async function handleLocal(req: NextRequest) {
  ensureScraping();

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/prom\/?/, "");
  const query = url.searchParams.get("query") || "";

  if (path === "query") {
    const parsed = parsePromQL(query);
    if (parsed.type === "instant") {
      return promResponse(instantQuery(parsed.metric));
    }
    // For rate/histogram on instant, use last 60s
    const now = Date.now() / 1000;
    if (parsed.type === "rate") {
      return promResponse(rateQuery(parsed.metric, now - 60, now, 15));
    }
    if (parsed.type === "histogram_quantile") {
      return promResponse(
        histogramQuantileQuery(parsed.quantile, parsed.metric, now - 300, now, 15)
      );
    }
  }

  if (path === "query_range") {
    const start = parseFloat(url.searchParams.get("start") || "0");
    const end = parseFloat(url.searchParams.get("end") || "0");
    const step = parseFloat(url.searchParams.get("step") || "15");
    const parsed = parsePromQL(query);

    if (parsed.type === "instant") {
      return promResponse(rangeQuery(parsed.metric, start, end, step));
    }
    if (parsed.type === "rate") {
      return promResponse(rateQuery(parsed.metric, start, end, step));
    }
    if (parsed.type === "histogram_quantile") {
      return promResponse(
        histogramQuantileQuery(parsed.quantile, parsed.metric, start, end, step)
      );
    }
  }

  return NextResponse.json({ status: "error", error: "unsupported query" }, { status: 400 });
}

async function handleProxy(req: NextRequest) {
  const url = new URL(req.url);
  const apiPath = url.pathname.replace(/^\/prom\/?/, "");
  const target = `${PROMETHEUS_URL}/api/v1/${apiPath}${url.search}`;

  try {
    const resp = await fetch(target, { method: "GET" });
    const data = await resp.arrayBuffer();
    return new NextResponse(data, {
      status: resp.status,
      headers: {
        "Content-Type": resp.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    console.error(`Failed to proxy to Prometheus: ${target}`, err);
    return NextResponse.json(
      { status: "error", error: "Prometheus unavailable" },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (PROMETHEUS_URL) {
    return handleProxy(req);
  }
  return handleLocal(req);
}
