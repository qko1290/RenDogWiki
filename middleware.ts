// =============================================
// File: middleware.ts
// 렌독위키 IP 차단용
// =============================================

import { NextRequest, NextResponse } from "next/server";

const BLOCKED_IPS = new Set([
  "165.232.154.185",
  "209.38.151.85",
]);

export function middleware(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");

  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : req.ip ?? "";

  if (BLOCKED_IPS.has(ip)) {
    return new NextResponse("Access Denied", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
