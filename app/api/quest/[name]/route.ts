// =============================================
// File: app/api/quest/[name]/route.ts
// =============================================
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

// [GET] 단일 quest npc 조회
export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const rows = await sql`
    SELECT name, village_name, icon, "order", reward, reward_icon, requirement, line,
      location_x, location_y, location_z, quest, npc_type
    FROM npc
    WHERE name = ${name} AND npc_type = 'quest'
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "존재하지 않음" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

// [PATCH] quest npc 정보 수정
export async function PATCH(req: NextRequest, { params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const body = await req.json();
  // 허용 필드
  const fields = [
    "name", "village_name", "icon", "order", "reward", "reward_icon",
    "requirement", "line", "location_x", "location_y", "location_z", "quest"
  ];
  const setClauses: string[] = [];
  const values: any[] = [];
  fields.forEach(field => {
    if (body[field] !== undefined) {
      setClauses.push(`"${field}" = $${setClauses.length + 1}`);
      values.push(body[field]);
    }
  });
  if (setClauses.length === 0)
    return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });

  // 쿼리 문자열 만들기 (sql-template)
  const sqlQuery = `
    UPDATE npc SET ${setClauses.join(", ")}
    WHERE name = $${setClauses.length + 1} AND npc_type = 'quest'
  `;
  values.push(name);
  // 직접 query (neon에서 sql\`...\`는 쿼리+파라미터 분리 안되니, 임시로)
  await sql.unsafe(sqlQuery);

  return NextResponse.json({ success: true });
}

// [DELETE] 단일 quest npc 삭제
export async function DELETE(req: NextRequest, { params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  await sql`
    DELETE FROM npc WHERE name = ${name} AND npc_type = 'quest'
  `;
  return NextResponse.json({ success: true });
}
