// =============================================
// File: app/api/villages/route.ts
// =============================================
/**
 * 마을 전체 조회/추가 API
 * - [GET] 전체 마을 목록 또는 특정 이름(name)으로 단일 조회
 * - [POST] 마을 신규 추가
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

/**
 * [마을 목록/단일 조회] GET
 * - name 쿼리 파라미터 없으면 전체 리스트 반환 (정렬: order, name)
 * - name 쿼리 파라미터 있으면 해당 이름의 마을만 반환 (없으면 204)
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");

  // 전체 리스트 조회
  if (!name) {
    const rows = await sql`SELECT * FROM village ORDER BY "order", name`;
    return NextResponse.json(rows); // 항상 배열 반환
  }

  // 단일 조회 (name 기준)
  const rows = await sql`SELECT * FROM village WHERE name = ${name}`;
  if (!rows.length) return NextResponse.json({}, { status: 204 });
  return NextResponse.json(rows[0]);
}

/**
 * [마을 추가] POST
 * - 입력: name, icon(필수), order(옵션), head_icon(옵션)
 * - 성공 시 생성된 마을 row 반환
 */
export async function POST(req: NextRequest) {
  const { name, icon, order, head_icon } = await req.json();
  if (!name || !icon) {
    return NextResponse.json({ error: "name, icon 필수" }, { status: 400 });
  }
  const rows = await sql`
    INSERT INTO village (name, icon, "order", head_icon)
    VALUES (${name}, ${icon}, ${order ?? 0}, ${head_icon ?? null})
    RETURNING id, name, icon, "order", head_icon
  `;
  return NextResponse.json(rows[0]);
}
