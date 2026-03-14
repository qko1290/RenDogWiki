// =============================================
// File: app/api/track/route.ts
// - 접속자 IP 수집
// - x-forwarded-for 기반
// - SHA-256 해시 저장
// - 캐시 완전 비활성화
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
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

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    // 예시 테이블: visitor_logs
    // 필요 없다면 아래 insert는 제거 가능
    await sql`
      INSERT INTO visitor_logs (ip_hash, created_at)
      VALUES (${ipHash}, NOW())
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
