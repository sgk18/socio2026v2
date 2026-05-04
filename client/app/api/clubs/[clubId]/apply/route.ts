import { NextRequest, NextResponse } from "next/server";

const normalizeBackendBase = (value: string) =>
  String(value || "").trim().replace(/\/api\/?$/, "").replace(/\/+$/, "");

const getBackendBaseUrl = (request: NextRequest): string | null => {
  const configured = normalizeBackendBase(
    process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || ""
  );
  const requestOrigin = normalizeBackendBase(request.nextUrl.origin);
  const hostname = request.nextUrl.hostname.toLowerCase();
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalHost) {
    const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
    if (configured && configuredIsLocal) return configured;
    return "http://localhost:8000";
  }

  if (configured && configured !== requestOrigin) return configured;

  return null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type");
    const body = await request.text();
    const backendBase = getBackendBaseUrl(request);
    if (!backendBase) {
      return NextResponse.json({ error: "API URL not configured" }, { status: 500 });
    }

    const upstream = await fetch(
      `${backendBase}/api/clubs/${encodeURIComponent(clubId)}/apply`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          ...(contentType ? { "Content-Type": contentType } : {}),
        },
        body,
        cache: "no-store",
      }
    );

    const upstreamContentType = upstream.headers.get("content-type") || "application/json";
    const text = await upstream.text();
    const fallbackPayload = JSON.stringify({ error: "Empty response from club service" });

    return new NextResponse(text || fallbackPayload, {
      status: upstream.status,
      headers: {
        "Content-Type": upstreamContentType.includes("application/json")
          ? upstreamContentType
          : "application/json",
      },
    });
  } catch (error: any) {
    console.error("Club apply proxy error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to reach club backend" },
      { status: 500 }
    );
  }
}
