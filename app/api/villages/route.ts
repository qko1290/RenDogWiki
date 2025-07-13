import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

// [GET] 마을 전체 조회
export async function GET() {
  const result = await sql.unsafe(
    'SELECT name, icon, "order" FROM village ORDER BY "order", name'
  );
  const rows = await sql`SELECT name, icon, "order" FROM village ORDER BY "order", name`;
  return NextResponse.json(Array.isArray(rows) ? rows : []);
}

// [POST] 마을 추가
export async function POST(req: NextRequest) {
  const { name, icon, order } = await req.json();
  if (!name || !icon) {
    return NextResponse.json({ error: "name, icon 필수" }, { status: 400 });
  }
  const sqlQuery = `
    INSERT INTO village (name, icon, "order")
    VALUES ('${name.replaceAll("'", "''")}', '${icon.replaceAll("'", "''")}', ${order ?? 0})
  `;
  await sql.unsafe(sqlQuery);
  return NextResponse.json({ success: true });
}
