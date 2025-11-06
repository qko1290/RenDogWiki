// =============================================
// File: app/api/categories/modes/route.ts
// =============================================
/**
/**
 * 사용 가능한 "모드 태그" 목록 API
 * - GET /api/categories/modes?q=foo
 *   - categories.mode_tags(TEXT[])를 unnest 해서 고유 태그 + 사용 카테고리 수 집계
 *   - ?q=foo  -> 부분 일치(대소문자 무시) 필터
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { cached, cacheKey } from '@/wiki/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'auto';

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
    const key = cacheKey('modes', q || 'all');

    const rows = await cached(
      key,
      { ttlSec: 600, tags: ['category:modes', 'category:list'] },
      async () => {
        const where = q ? sql`WHERE tag ILIKE ${'%' + q + '%'}` : sql``;
        const data = await sql`
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
        return data;
      }
    );

    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    });
  } catch (err) {
    console.error('[modes GET] unexpected error:', err);
    return NextResponse.json(
      { error: '모드 태그를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
