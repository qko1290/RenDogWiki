import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db"; // @neondatabase/serverless

// [GET] 특정 village의 npc 목록 반환 (쿼리: ?village_name=xxx)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const village_name = searchParams.get("village_name");
  if (!village_name) {
    return NextResponse.json({ error: "village_name 필수" }, { status: 400 });
  }
  // 'quest' 타입만 필터링해서 조회 (일반 NPC는 안나오게!)
  const sqlQuery = `
    SELECT name, village_name, icon, "order", reward, reward_icon, requirement, line,
           location_x, location_y, location_z, quest, npc_type
    FROM npc
    WHERE village_name = '${village_name.replaceAll("'", "''")}'
      AND npc_type = 'quest'
    ORDER BY "order", name
  `;
  const rows = await sql.unsafe(sqlQuery);
  return NextResponse.json(rows);
}

// [POST] npc 추가
export async function POST(req: NextRequest) {
  const body = await req.json();
  // null/undefined만 체크
  const required = ["name", "village_name", "icon", "order", "location_x", "location_y", "location_z", "quest", "npc_type"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null) {
      return NextResponse.json({ error: `${key} 필수` }, { status: 400 });
    }
  }
  // 각 값 escape
  const escape = (v: any) =>
    v === null || v === undefined
      ? "NULL"
      : typeof v === "string"
      ? `'${v.replaceAll("'", "''")}'`
      : v;
  const sqlQuery = `
    INSERT INTO npc
      (name, village_name, icon, "order", reward, reward_icon, requirement, line,
       location_x, location_y, location_z, quest, npc_type)
    VALUES (
      ${escape(body.name)},
      ${escape(body.village_name)},
      ${escape(body.icon)},
      ${escape(body.order)},
      ${escape(body.reward)},
      ${escape(body.reward_icon)},
      ${escape(body.requirement)},
      ${escape(body.line)},
      ${escape(body.location_x)},
      ${escape(body.location_y)},
      ${escape(body.location_z)},
      ${escape(body.quest)},
      ${escape(body.npc_type)}
    )
  `;
  await sql.unsafe(sqlQuery);
  return NextResponse.json({ success: true });
}
