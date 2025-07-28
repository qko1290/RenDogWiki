// =============================================
// File: app/api/head/[id]/route.ts
// =============================================
/**
 * [PATCH] 머리 찾기(Head Finder) 정보 수정 API
 * - village_id, order, location_x/y/z, pictures(배열) 업데이트
 * - PATCH /api/head/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json();

  // 필수값 체크: village_id, order는 number, pictures는 배열
  if (
    typeof body.village_id !== "number" ||
    typeof body.order !== "number" ||
    !Array.isArray(body.pictures)
  ) {
    return NextResponse.json({ error: "필수값 누락" }, { status: 400 });
  }

  // 업데이트
  await sql`
    UPDATE head_finder SET
      village_id = ${body.village_id},
      "order" = ${body.order},
      location_x = ${body.location_x},
      location_y = ${body.location_y},
      location_z = ${body.location_z},
      pictures = ${JSON.stringify(body.pictures)}
    WHERE id = ${id}
  `;

  // 갱신된 데이터 조회 후 반환 (pictures: JSON 파싱 보정)
  const [updated] = await sql`
    SELECT id, village_id, "order", location_x, location_y, location_z, pictures
    FROM head_finder WHERE id = ${id}
  `;
  updated.pictures = Array.isArray(updated.pictures)
    ? updated.pictures
    : JSON.parse(updated.pictures ?? "[]");
  return NextResponse.json(updated);
}
