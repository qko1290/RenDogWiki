// =============================================
// File: app/api/head/[id]/route.ts
// =============================================
/**
 * [PATCH] 머리 찾기(Head Finder) 정보 수정 API
 * - village_id, order, location_x/y/z, pictures(배열) 업데이트
 * - PATCH /api/head/[id]
 * - ⚠️ 부분 업데이트 지원: body에 온 필드만 변경, 나머지는 기존 값 유지
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

type HeadRow = {
  id: number;
  village_id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures: any; // DB에 json/text 형태일 수 있음
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();

  // 1) 현재 행 조회
  const rows = await sql`SELECT * FROM head_finder WHERE id = ${id}`;
  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const cur = rows[0] as HeadRow;

  // 2) 현재 pictures 파싱
  const curPictures = Array.isArray(cur.pictures)
    ? cur.pictures
    : JSON.parse(cur.pictures ?? "[]");

  // 3) body에 온 필드만 덮어쓰는 병합 (없으면 기존값 유지)
  const merged = {
    village_id:
      body.village_id !== undefined ? Number(body.village_id) : cur.village_id,
    order: body.order !== undefined ? Number(body.order) : cur.order,
    location_x:
      body.location_x !== undefined ? Number(body.location_x) : cur.location_x,
    location_y:
      body.location_y !== undefined ? Number(body.location_y) : cur.location_y,
    location_z:
      body.location_z !== undefined ? Number(body.location_z) : cur.location_z,
    pictures:
      body.pictures === undefined
        ? curPictures
        : Array.isArray(body.pictures)
        ? body.pictures
        : [],
  };

  // 4) 업데이트
  await sql`
    UPDATE head_finder SET
      village_id = ${merged.village_id},
      "order"    = ${merged.order},
      location_x = ${merged.location_x},
      location_y = ${merged.location_y},
      location_z = ${merged.location_z},
      pictures   = ${JSON.stringify(merged.pictures)}
    WHERE id = ${id}
  `;

  // 5) 갱신된 데이터 조회 후 반환 (pictures: JSON 파싱 보정)
  const [updated] = await sql`
    SELECT id, village_id, "order", location_x, location_y, location_z, pictures
    FROM head_finder WHERE id = ${id}
  `;
  updated.pictures = Array.isArray(updated.pictures)
    ? updated.pictures
    : JSON.parse(updated.pictures ?? "[]");

  return NextResponse.json(updated);
}
