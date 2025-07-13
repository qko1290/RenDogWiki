import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const body = await req.json();

  // 수정 가능한 필드 목록
  const updatableFields = [
    "name", "icon", "location_x", "location_y", "location_z", "line"
  ];

  // 실제 변경할 필드 추출 및 escape
  const setClauses = [];
  for (const field of updatableFields) {
    if (body[field] !== undefined) {
      const value =
        body[field] === null || body[field] === undefined
          ? "NULL"
          : typeof body[field] === "string"
          ? `'${body[field].replaceAll("'", "''")}'`
          : body[field];
      setClauses.push(`"${field}" = ${value}`);
    }
  }
  if (setClauses.length === 0) {
    return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });
  }
  // NPC 이름으로 식별 (DB에서 name은 유니크라 가정)
  const sqlQuery = `
    UPDATE npc SET ${setClauses.join(", ")}
    WHERE name = '${name.replaceAll("'", "''")}'
  `;
  await sql.unsafe(sqlQuery);
  return NextResponse.json({ success: true });
}
