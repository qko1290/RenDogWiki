// =============================================
// File: app/api/categories/modes/route.ts
// =============================================
/**
 * 사용 가능한 "모드 태그" 목록 API
 * - GET /api/modes
 *   - 카테고리 테이블(categories.mode_tags TEXT[])을 unnest 해
 *     고유 태그와 사용된 카테고리 수를 집계하여 반환
 *   - 쿼리: ?q=foo  -> 태그 부분 일치(대소문자 무시) 필터
 *
 * 응답 예시:
 * [
 *   { tag: "pvp", category_count: 12 },
 *   { tag: "creative", category_count: 7 }
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q');
    const where = q ? sql`WHERE tag ILIKE ${'%' + q.trim() + '%'}` : sql``;

    const rows = await sql`
      WITH tags AS (
        SELECT lower(trim(t)) AS tag
        FROM categories c
        CROSS JOIN LATERAL unnest(COALESCE(c.mode_tags, '{}'::text[])) AS t
      )
      SELECT tag, COUNT(*)::int AS category_count
      FROM tags
      ${where}
      GROUP BY tag
      ORDER BY tag
    `;

    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[modes GET] unexpected error:', err);
    return NextResponse.json(
      { error: '모드 태그를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
