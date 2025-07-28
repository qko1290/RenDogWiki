// =============================================
// File: app/api/head/route.ts
// =============================================
/**
 * [GET]   /api/head?village_id=xxx : 마을별 Head Finder 목록 반환
 * [POST]  /api/head                : Head Finder 신규 등록
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

// [GET] ?village_id=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const village_id = searchParams.get("village_id");
  if (!village_id) return NextResponse.json([], { status: 200 });

  const rows = await sql`
    SELECT id, village_id, "order", location_x, location_y, location_z, pictures
    FROM head_finder
    WHERE village_id = ${Number(village_id)}
    ORDER BY "order"
  `;
  rows.forEach(r => {
    if (typeof r.pictures === "string") r.pictures = JSON.parse(r.pictures ?? "[]");
  });
  return NextResponse.json(rows);
}

// [POST] 추가
export async function POST(req: NextRequest) {
  const body = await req.json();
  const required = [
    "village_id", "order", "location_x", "location_y", "location_z", "pictures"
  ];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null) {
      return NextResponse.json({ error: `${key} 필수` }, { status: 400 });
    }
  }
  const [row] = await sql`
    INSERT INTO head_finder
      (village_id, "order", location_x, location_y, location_z, pictures)
    VALUES (
      ${Number(body.village_id)},
      ${body.order},
      ${body.location_x},
      ${body.location_y},
      ${body.location_z},
      ${JSON.stringify(body.pictures)}
    )
    RETURNING id, village_id, "order", location_x, location_y, location_z, pictures
  `;
  row.pictures = Array.isArray(row.pictures) ? row.pictures : JSON.parse(row.pictures ?? "[]");
  return NextResponse.json(row);
}
