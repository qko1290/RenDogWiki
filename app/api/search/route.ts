// =============================================
// File: app/api/search/route.ts
// =============================================
/**
 * 위키 문서 통합 검색
 * - GET 쿼리 ->
 *   - query: 검색어(필수, 부분 일치)
 *   - limit: 1~500 (기본 200)  // 최종 병합 결과 상한
 * - 검색 대상 -> 제목(title), 태그(tags), 본문(content)
 * - 중복 문서는 우선순위로 1회만 반환 -> title > tags > content
 * - 정렬 -> 각 범주 내 updated_at DESC, 병합 후 limit 적용
 * - 응답은 캐시 금지
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // 1) 파라미터 파싱
    const sp = req.nextUrl.searchParams;
    const raw = (sp.get("query") ?? "").trim();
    const lim = Number(sp.get("limit"));
    const limit = Number.isFinite(lim) ? Math.min(500, Math.max(1, Math.trunc(lim))) : 200;

    if (!raw) {
      return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    }

    const pattern = `%${raw}%`;

    // path 기반 breadcrumb 생성 식 (Postgres)
    // - path를 '/'로 split
    // - 조각이 2개 이상이면 마지막 조각은 제외(문서명/슬러그일 가능성 높음)
    // - 'A > B > C' 형태 문자열로 반환
    const breadcrumbExpr = sql/*sql*/`
      (
        WITH parts AS (
          SELECT regexp_split_to_array(
            regexp_replace(COALESCE((path)::text, ''), '^/+|/+$', '', 'g'),
            '/+'
          ) AS pp
        )
        SELECT array_to_string(
          CASE
            WHEN array_length(pp, 1) IS NULL THEN ARRAY[]::text[]
            WHEN array_length(pp, 1) >= 2 THEN pp[1:array_length(pp, 1) - 1]
            ELSE pp
          END,
          ' > '
        )
        FROM parts
      )
    `;

    // 2) title 검색
    const titleRows = await sql/*sql*/`
      SELECT
        id, title, path, icon, tags,
        'title' AS match_type,
        ${breadcrumbExpr} AS category_breadcrumb
      FROM documents
      WHERE title ILIKE ${pattern}
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `;

    // 3) tags 검색
    const tagRows = await sql/*sql*/`
      SELECT
        id, title, path, icon, tags,
        'tags' AS match_type,
        ${breadcrumbExpr} AS category_breadcrumb
      FROM documents
      WHERE tags ILIKE ${pattern}
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `;

    // 4) 본문 검색
    const contentRows = await sql/*sql*/`
      SELECT
        d.id, d.title, d.path, d.icon, d.tags,
        'content' AS match_type,
        LEFT(REGEXP_REPLACE(dc.content, '\\s+', ' ', 'g'), 1024) AS content,
        (
          WITH parts AS (
            SELECT regexp_split_to_array(
              regexp_replace(COALESCE((d.path)::text, ''), '^/+|/+$', '', 'g'),
              '/+'
            ) AS pp
          )
          SELECT array_to_string(
            CASE
              WHEN array_length(pp, 1) IS NULL THEN ARRAY[]::text[]
              WHEN array_length(pp, 1) >= 2 THEN pp[1:array_length(pp, 1) - 1]
              ELSE pp
            END,
            ' > '
          )
          FROM parts
        ) AS category_breadcrumb
      FROM documents d
      JOIN document_contents dc ON d.id = dc.document_id
      WHERE dc.content ILIKE ${pattern}
      ORDER BY d.updated_at DESC NULLS LAST, d.id DESC
      LIMIT ${limit}
    `;

    // 5) 우선순위 병합 (title > tags > content)
    const seen = new Set<number>();
    const merged: any[] = [];

    const pushUnique = (rows: any[]) => {
      for (const row of rows) {
        const id = Number(row.id);
        if (seen.has(id)) continue;

        merged.push({
          ...row,
          // tags를 배열로 보정
          tags: row.tags ? String(row.tags).split(",") : [],
          // breadcrumb는 string 보정
          category_breadcrumb: row.category_breadcrumb ? String(row.category_breadcrumb) : "",
        });

        seen.add(id);
        if (merged.length >= limit) break;
      }
    };

    pushUnique(titleRows as any[]);
    if (merged.length < limit) pushUnique(tagRows as any[]);
    if (merged.length < limit) pushUnique(contentRows as any[]);

    // 6) 응답
    return NextResponse.json(merged, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[search GET] unexpected error:", err);
    return NextResponse.json(
      { error: "server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}