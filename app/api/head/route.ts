// =============================================
// File: app/api/head/route.ts
// =============================================
/**
 * [GET]   /api/head?village_id=xxx : 마을별 Head Finder 목록 반환
 * [POST]  /api/head                : Head Finder 신규 등록
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

// [GET] ?village_id=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const villageIdParam = searchParams.get("village_id");
  const village_id = villageIdParam ? Number(villageIdParam) : NaN;

  // village_id 없거나 숫자 아님 → 빈 배열
  if (!villageIdParam || isNaN(village_id)) {
    return NextResponse.json([], { status: 200 });
  }

  const rowsRaw = await sql`
    SELECT id, village_id, "order", location_x, location_y, location_z, pictures
    FROM head_finder
    WHERE village_id = ${village_id}
    ORDER BY "order"
  `;
  const rows = rowsRaw as unknown as HeadRow[];

  rows.forEach((r) => {
    r.pictures = Array.isArray(r.pictures)
      ? r.pictures
      : JSON.parse((r as any).pictures ?? "[]");
  });

  return NextResponse.json(rows);
}

// [POST] 추가
export async function POST(req: NextRequest) {
  const body = await req.json();

  const required = [
    "village_id",
    "order",
    "location_x",
    "location_y",
    "location_z",
    "pictures",
  ] as const;

  for (const key of required) {
    if (body[key] === undefined || body[key] === null) {
      return NextResponse.json({ error: `${key} 필수` }, { status: 400 });
    }
  }

  const pictures = Array.isArray(body.pictures) ? body.pictures : [];

  const [rowRaw] = await sql`
    INSERT INTO head_finder
      (village_id, "order", location_x, location_y, location_z, pictures)
    VALUES (
      ${Number(body.village_id)},
      ${Number(body.order)},
      ${Number(body.location_x)},
      ${Number(body.location_y)},
      ${Number(body.location_z)},
      ${JSON.stringify(pictures)}
    )
    RETURNING id, village_id, "order", location_x, location_y, location_z, pictures
  `;

  const row = rowRaw as HeadRow;
  row.pictures = Array.isArray(row.pictures)
    ? row.pictures
    : JSON.parse((row as any).pictures ?? "[]");

  return NextResponse.json(row);
}
