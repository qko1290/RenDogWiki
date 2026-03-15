// =============================================
// File: app/api/search/route.ts
// (전체 코드)
// - title / tags:
//   1) 부분검색
//   2) 공백 제거 검색
//   3) pg_trgm 유사도 검색
//   4) 비연속 글자 매칭(subsequence regex)
// - content:
//   - 일반 검색 + 공백 제거 검색 복구
//   - 비연속 글자 매칭 / trgm 미적용
// - 우선순위 병합: title > tags > content
// - DB timeout 시 빈 배열 반환(200)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { sql, runDbRead, isTransientDbError } from "@/wiki/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchRow = {
  id: number;
  title: string;
  path: string | number;
  icon?: string | null;
  tags?: string | string[] | null;
  match_type: "title" | "tags" | "content";
  content?: string | null;
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

function shouldUseLooseRegex(raw: string) {
  return compactSearchText(raw).length >= 2;
}

function escapeRegexChar(ch: string) {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * "아도" -> "아.*도"
 * 공백 제거 기준으로 비연속 글자 매칭
 */
function makeLooseRegex(raw: string) {
  const compact = compactSearchText(raw);
  if (!compact) return "";
  return compact
    .split("")
    .map(escapeRegexChar)
    .join(".*");
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];

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
    const useLooseRegex = shouldUseLooseRegex(raw);
    const looseRegex = makeLooseRegex(raw);

    const breadcrumbExpr = sql/* sql */`
      (
        WITH parts AS (
          SELECT regexp_split_to_array(
            regexp_replace(COALESCE((path)::text, ''), '^/+|/+$', '', 'g'),
            '/+'
          ) AS pp
        ),
        ids AS (
          SELECT (pp[i])::bigint AS cid, i AS ord
          FROM parts, generate_subscripts(pp, 1) AS g(i)
          WHERE pp[i] ~ '^[0-9]+$'
        )
        SELECT COALESCE(string_agg(c.name, ' > ' ORDER BY ids.ord), '')
        FROM ids
        JOIN categories c ON c.id = ids.cid
      )
    `;

    const [titleRows, tagRows, contentRows] = await runDbRead(
      "search:all",
      async () => {
        const titlePromise = sql/* sql */`
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
                WHEN ${useLooseRegex} AND regexp_replace(LOWER(COALESCE(d.title, '')), '\\s+', '', 'g') ~ ${looseRegex} THEN 66
                ELSE 0
              END,
              CASE
                WHEN ${useTrgm} THEN similarity(LOWER(COALESCE(d.title, '')), ${normalizedRaw}) * 60
                ELSE 0
              END
            ) AS score
          FROM documents d
          WHERE
            LOWER(COALESCE(d.title, '')) LIKE LOWER(${pattern})
            OR regexp_replace(LOWER(COALESCE(d.title, '')), '\\s+', '', 'g') LIKE ${compactPattern}
            OR (
              ${useLooseRegex}
              AND regexp_replace(LOWER(COALESCE(d.title, '')), '\\s+', '', 'g') ~ ${looseRegex}
            )
            OR (
              ${useTrgm}
              AND similarity(LOWER(COALESCE(d.title, '')), ${normalizedRaw}) >= 0.2
            )
          ORDER BY score DESC, d.updated_at DESC NULLS LAST, d.id DESC
          LIMIT ${limit}
        `;

        const tagPromise = sql/* sql */`
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
                WHEN ${useLooseRegex} AND regexp_replace(LOWER(COALESCE(d.tags::text, '')), '\\s+', '', 'g') ~ ${looseRegex} THEN 50
                ELSE 0
              END,
              CASE
                WHEN ${useTrgm} THEN similarity(LOWER(COALESCE(d.tags::text, '')), ${normalizedRaw}) * 45
                ELSE 0
              END
            ) AS score
          FROM documents d
          WHERE
            LOWER(COALESCE(d.tags::text, '')) LIKE LOWER(${pattern})
            OR regexp_replace(LOWER(COALESCE(d.tags::text, '')), '\\s+', '', 'g') LIKE ${compactPattern}
            OR (
              ${useLooseRegex}
              AND regexp_replace(LOWER(COALESCE(d.tags::text, '')), '\\s+', '', 'g') ~ ${looseRegex}
            )
            OR (
              ${useTrgm}
              AND similarity(LOWER(COALESCE(d.tags::text, '')), ${normalizedRaw}) >= 0.2
            )
          ORDER BY score DESC, d.updated_at DESC NULLS LAST, d.id DESC
          LIMIT ${limit}
        `;

        const contentPromise = sql/* sql */`
          SELECT
            d.id,
            d.title,
            d.path,
            d.icon,
            d.tags,
            'content' AS match_type,
            LEFT(REGEXP_REPLACE(dc.content, '\\s+', ' ', 'g'), 1024) AS content,
            (
              WITH parts AS (
                SELECT regexp_split_to_array(
                  regexp_replace(COALESCE((d.path)::text, ''), '^/+|/+$', '', 'g'),
                  '/+'
                ) AS pp
              ),
              ids AS (
                SELECT (pp[i])::bigint AS cid, i AS ord
                FROM parts, generate_subscripts(pp, 1) AS g(i)
                WHERE pp[i] ~ '^[0-9]+$'
              )
              SELECT COALESCE(string_agg(c.name, ' > ' ORDER BY ids.ord), '')
              FROM ids
              JOIN categories c ON c.id = ids.cid
            ) AS category_breadcrumb,
            CASE
              WHEN LOWER(COALESCE(dc.content, '')) LIKE LOWER(${pattern}) THEN 30
              WHEN regexp_replace(LOWER(COALESCE(dc.content, '')), '\\s+', '', 'g') LIKE ${compactPattern} THEN 28
              ELSE 0
            END AS score
          FROM documents d
          JOIN document_contents dc ON d.id = dc.document_id
          WHERE
            LOWER(COALESCE(dc.content, '')) LIKE LOWER(${pattern})
            OR regexp_replace(LOWER(COALESCE(dc.content, '')), '\\s+', '', 'g') LIKE ${compactPattern}
          ORDER BY score DESC, d.updated_at DESC NULLS LAST, d.id DESC
          LIMIT ${limit}
        `;

        return await Promise.all([titlePromise, tagPromise, contentPromise]);
      }
    );

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

    pushUnique((titleRows ?? []) as unknown as SearchRow[]);
    if (merged.length < limit) pushUnique((tagRows ?? []) as unknown as SearchRow[]);
    if (merged.length < limit) pushUnique((contentRows ?? []) as unknown as SearchRow[]);

    return NextResponse.json(merged, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[search GET] unexpected error:", err);

    if (isTransientDbError(err)) {
      return NextResponse.json([], {
        status: 200,
        headers: { "Cache-Control": "no-store", "X-Search-Degraded": "1" },
      });
    }

    return NextResponse.json(
      { error: "server error" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}