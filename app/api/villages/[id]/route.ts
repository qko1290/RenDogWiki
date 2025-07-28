// =============================================
// File: app/api/villages/[id]/route.ts
// =============================================
/**
 * 마을 정보 수정/삭제 API
 * - [PATCH] 특정 마을(id) 정보 수정 (name, icon, order, head_icon)
 * - [DELETE] 특정 마을(id) 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

/**
 * [마을 정보 수정] PATCH
 * - 입력: id(경로 파라미터), name, icon(필수), order, head_icon(선택)
 * - 필수값 누락시 400 반환
 * - 수정 성공시 { success: true } 반환
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const body = await req.json();
  const { name, icon, order, head_icon } = body;

  if (!id || !name || !icon) {
    return NextResponse.json({ error: "id, name, icon 필수" }, { status: 400 });
  }

  await sql`
    UPDATE village
    SET name = ${name}, icon = ${icon}, "order" = ${order ?? 0}, head_icon = ${head_icon ?? null}
    WHERE id = ${id}
  `;
  return NextResponse.json({ success: true });
}

/**
 * [마을 삭제] DELETE
 * - 입력: id(경로 파라미터)
 * - 삭제 성공시 { success: true } 반환
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  await sql`DELETE FROM village WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
