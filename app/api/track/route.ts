// =============================================
// File: app/api/track/route.ts
// - 접속자 원본 IP 기록
// - Vercel 환경 대응 (x-forwarded-for 우선)
// - 캐시 완전 비활성화
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  if (xff) {
    return xff.split(",")[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    await sql`
      INSERT INTO visitor_logs (ip, created_at)
      VALUES (${ip}, NOW())
    `;

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("[track] error:", err);

    return NextResponse.json(
      { ok: false },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
