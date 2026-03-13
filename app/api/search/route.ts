// =============================================
// File: app/api/search/route.ts
// (전체 코드)
// - pg_trgm 기반 유사 검색 + 띄어쓰기 무시 검색 지원
// - title / tags 에만 적용
// - content 검색 완전 제외
// - 우선순위 병합: title > tags
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchRow = {
  id: number;
  title: string;
  path: string | number;
  icon?: string | null;
  tags?: string | string[] | null;
  match_type: "title" | "tags";
  category_breadcrumb?: string | null;
  score?: number | null;
};

function compactSearchText(v: string) {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function normalizeSearchText(v: string) {
  return String(v ?? "").toLowerCase().trim();
}

function shouldUseTrgm(raw: string) {
  return compactSearchText(raw).length >= 3;
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];

    // postgres text[] 문자열 대응: {a,b,c}
    if (s.startsWith("{") && s.endsWith("}")) {
      return s
        .slice(1, -1)
        .split(",")
        .map((v) => v.replace(/^"(.*)"$/, "$1").trim())
        .filter(Boolean);
    }

    return s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const raw = (sp.get("query") ?? "").trim();
    const lim = Number(sp.get("limit"));
    const limit = Number.isFinite(lim)
      ? Math.min(500, Math.max(1, Math.trunc(lim)))
      : 50;

    if (!raw) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const normalizedRaw = normalizeSearchText(raw);
    const compactRaw = compactSearchText(raw);
    const pattern = `%${raw}%`;
    const compactPattern = `%${compactRaw}%`;
    const useTrgm = shouldUseTrgm(raw);

    const breadcrumbExpr = sql/* sql */ `
      (
        WITH parts AS (
          SELECT regexp_split_to_array(
            regexp_replace(COALESCE((path)::text, ''), '^/+|/+$', '', 'g'),
            '/+'
          ) AS pp
        ),
        ids AS (
          SELECT
            (pp[i])::bigint AS cid,
            i AS ord
          FROM parts, generate_subscripts(pp, 1) AS g(i)
          WHERE pp[i] ~ '^[0-9]+$'
        )
        SELECT COALESCE(string_agg(c.name, ' > ' ORDER BY ids.ord), '')
        FROM ids
        JOIN categories c ON c.id = ids.cid
      )
    `;

    // 1) 제목 검색
    const titleRows = await sql<SearchRow[]>/* sql */ `
      SELECT
        d.id,
        d.title,
        d.path,
        d.icon,
        d.tags,
        'title' AS match_type,
        ${breadcrumbExpr} AS category_breadcrumb,
        GREATEST(
          CASE
            WHEN LOWER(COALESCE(d.title, '')) = ${normalizedRaw} THEN 100
            WHEN LOWER(COALESCE(d.title, '')) LIKE LOWER(${pattern}) THEN 80
            WHEN regexp_replace(LOWER(COALESCE(d.title, '')), '\\s+', '', 'g') LIKE ${compactPattern} THEN 72
            ELSE 0
          END,
          CASE
            WHEN ${useTrgm}
              THEN similarity(LOWER(COALESCE(d.title, '')), ${normalizedRaw}) * 60
            ELSE 0
          END
        ) AS score
      FROM documents d
      WHERE
        LOWER(COALESCE(d.title, '')) LIKE LOWER(${pattern})
        OR regexp_replace(LOWER(COALESCE(d.title, '')), '\\s+', '', 'g') LIKE ${compactPattern}
        OR (
          ${useTrgm}
          AND similarity(LOWER(COALESCE(d.title, '')), ${normalizedRaw}) >= 0.2
        )
      ORDER BY score DESC, d.updated_at DESC NULLS LAST, d.id DESC
      LIMIT ${limit}
    `;

    // 2) 태그 검색
    const tagRows = await sql<SearchRow[]>/* sql */ `
      SELECT
        d.id,
        d.title,
        d.path,
        d.icon,
        d.tags,
        'tags' AS match_type,
        ${breadcrumbExpr} AS category_breadcrumb,
        GREATEST(
          CASE
            WHEN LOWER(COALESCE(d.tags::text, '')) LIKE LOWER(${pattern}) THEN 60
            WHEN regexp_replace(LOWER(COALESCE(d.tags::text, '')), '\\s+', '', 'g') LIKE ${compactPattern} THEN 54
            ELSE 0
          END,
          CASE
            WHEN ${useTrgm}
              THEN similarity(LOWER(COALESCE(d.tags::text, '')), ${normalizedRaw}) * 45
            ELSE 0
          END
        ) AS score
      FROM documents d
      WHERE
        LOWER(COALESCE(d.tags::text, '')) LIKE LOWER(${pattern})
        OR regexp_replace(LOWER(COALESCE(d.tags::text, '')), '\\s+', '', 'g') LIKE ${compactPattern}
        OR (
          ${useTrgm}
          AND similarity(LOWER(COALESCE(d.tags::text, '')), ${normalizedRaw}) >= 0.2
        )
      ORDER BY score DESC, d.updated_at DESC NULLS LAST, d.id DESC
      LIMIT ${limit}
    `;

    // 3) 우선순위 병합 (title > tags)
    const seen = new Set<number>();
    const merged: SearchRow[] = [];

    const pushUnique = (rows: SearchRow[]) => {
      for (const row of rows) {
        const id = Number(row.id);
        if (seen.has(id)) continue;

        merged.push({
          ...row,
          tags: parseTags(row.tags),
          category_breadcrumb: row.category_breadcrumb
            ? String(row.category_breadcrumb)
            : "",
        });

        seen.add(id);
        if (merged.length >= limit) break;
      }
    };

    pushUnique(titleRows ?? []);
    if (merged.length < limit) pushUnique(tagRows ?? []);

    return NextResponse.json(merged, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[search GET] unexpected error:", err);
    return NextResponse.json(
      { error: "server error" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}