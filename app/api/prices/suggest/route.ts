// =============================================
// File: app/api/prices/suggest/route.ts  (전체 코드)
// =============================================
import { NextResponse } from "next/server";
import { sql } from "@/app/wiki/lib/db";

// name_key 정규화: 프로젝트에서 실제 name_key 생성 규칙이 따로 있으면 여길 그 규칙으로 맞추면 됨
function toNameKey(input: string): string {
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\u200B/g, "")
    .trim();
}

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const qRaw = searchParams.get("q") ?? "";
    const q = toNameKey(qRaw);

    // q가 너무 짧으면 과도한 결과/부하 방지
    if (q.length < 1) {
      return NextResponse.json({ items: [] });
    }

    const mode = (searchParams.get("mode") ?? "").trim() || null;
    const limit = clampInt(searchParams.get("limit"), 10, 1, 20);

    // pg_trgm: % 연산자 + similarity 정렬
    // - name_key gin_trgm_ops 인덱스가 있으므로 % 조건이 성능에 유리
    // - q가 짧을 땐 너무 많은 hit가 날 수 있어서 limit 강제
    const rows = await sql<
      Array<{
        id: number;
        name: string;
        name_key: string;
        mode: string;
        updated_at: string;
        score: number;
      }>
    >`
      select
        id,
        name,
        name_key,
        mode,
        updated_at,
        similarity(name_key, ${q}) as score
      from public.price_items
      where
        (${mode}::text is null or mode = ${mode})
        and (
          name_key % ${q}
          or name ilike ${"%" + qRaw.trim() + "%"}
        )
      order by
        score desc,
        updated_at desc
      limit ${limit};
    `;

    return NextResponse.json({ items: rows ?? [] });
  } catch (err) {
    console.error("GET /api/prices/suggest failed:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}