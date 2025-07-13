// =============================================
// File: app/api/quest/route.ts
// =============================================
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

// [GET] 전체 quest 타입 NPC 목록 조회 (마을 필터 가능)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const village_name = searchParams.get("village_name");

  let rows;
  if (village_name) {
    rows = await sql`
      SELECT name, village_name, icon, "order", reward, reward_icon, requirement, line,
        location_x, location_y, location_z, quest, npc_type
      FROM npc
      WHERE village_name = ${village_name} AND npc_type = 'quest'
      ORDER BY "order", name
    `;
  } else {
    rows = await sql`
      SELECT name, village_name, icon, "order", reward, reward_icon, requirement, line,
        location_x, location_y, location_z, quest, npc_type
      FROM npc
      WHERE npc_type = 'quest'
      ORDER BY "order", name
    `;
  }
  return NextResponse.json(rows);
}

// [POST] quest 타입 npc 생성
export async function POST(req: NextRequest) {
  const body = await req.json();
  // 필수값 체크
  const required = [
    "name", "village_name", "icon", "order", "location_x", "location_y", "location_z", "quest"
  ];
  for (const key of required) {
    if (!body[key] && body[key] !== 0) {
      return NextResponse.json({ error: `${key} 필수` }, { status: 400 });
    }
  }
  await sql`
    INSERT INTO npc
      (name, village_name, icon, "order", reward, reward_icon, requirement, line,
      location_x, location_y, location_z, quest, npc_type)
      VALUES (
        ${body.name},
        ${body.village_name},
        ${body.icon},
        ${body.order},
        ${body.reward ?? null},
        ${body.reward_icon ?? null},
        ${body.requirement ?? null},
        ${body.line ?? null},
        ${body.location_x},
        ${body.location_y},
        ${body.location_z},
        ${body.quest},
        'quest'
      )
  `;
  return NextResponse.json({ success: true });
}

// [DELETE] npc 여러 개 삭제 (body: { names: string[] })
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!Array.isArray(body.names) || body.names.length === 0)
    return NextResponse.json({ error: "삭제할 이름 배열 필요" }, { status: 400 });
  await sql`
    DELETE FROM npc
    WHERE name = ANY(${body.names}) AND npc_type = 'quest'
  `;
  return NextResponse.json({ success: true, deleted: body.names });
}
