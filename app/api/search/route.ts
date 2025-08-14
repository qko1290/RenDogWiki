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

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // 1) 파라미터 파싱
    const sp = req.nextUrl.searchParams;
    const raw = (sp.get('query') ?? '').trim();
    const lim = Number(sp.get('limit'));
    const limit = Number.isFinite(lim) ? Math.min(500, Math.max(1, Math.trunc(lim))) : 200;

    if (!raw) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const pattern = `%${raw}%`;

    // 2) title 검색
    const titleRows = await sql/*sql*/`
      SELECT id, title, path, icon, tags, 'title' AS match_type
      FROM documents
      WHERE title ILIKE ${pattern}
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `;

    // 3) tags 검색
    const tagRows = await sql/*sql*/`
      SELECT id, title, path, icon, tags, 'tags' AS match_type
      FROM documents
      WHERE tags ILIKE ${pattern}
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `;

    // 4) 본문 검색
    const contentRows = await sql/*sql*/`
      SELECT
        d.id, d.title, d.path, d.icon, d.tags, 'content' AS match_type,
        LEFT(REGEXP_REPLACE(dc.content, '\\s+', ' ', 'g'), 1024) AS content
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
          tags: row.tags ? String(row.tags).split(',') : [],
        });
        seen.add(id);
        if (merged.length >= limit) break;
      }
    };

    pushUnique(titleRows as any[]);
    if (merged.length < limit) pushUnique(tagRows as any[]);
    if (merged.length < limit) pushUnique(contentRows as any[]);

    // 6) 응답
    return NextResponse.json(merged, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[search GET] unexpected error:', err);
    return NextResponse.json(
      { error: 'server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
