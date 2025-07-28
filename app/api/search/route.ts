// =============================================
// File: app/api/search/route.ts
// =============================================
/**
 * 위키 문서 통합 검색 API
 * - [GET] 쿼리 파라미터 query로 제목, 태그, 본문을 검색
 * - 반환: id, title, path, icon, tags, match_type, (본문 일부)
 * - match_type: title, tags, content 중 어디서 매칭됐는지 표시
 * - 중복 id는 title > tags > content 우선순위로 1회만 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db'; // 기존 sql 인스턴스 사용

export async function GET(req: NextRequest) {
  // 1. 검색어(query) 파싱 및 검사
  const query = req.nextUrl.searchParams.get('query');
  if (!query || query.trim() === '') {
    return NextResponse.json([]);
  }

  // 2. title에서 검색
  const titleRows = await sql`
    SELECT id, title, path, icon, tags, 'title' AS match_type
    FROM documents
    WHERE title ILIKE '%' || ${query} || '%'
  `;

  // 3. tags에서 검색
  const tagRows = await sql`
    SELECT id, title, path, icon, tags, 'tags' AS match_type
    FROM documents
    WHERE tags ILIKE '%' || ${query} || '%'
  `;

  // 4. 본문(content)에서 검색
  const contentRows = await sql`
    SELECT d.id, d.title, d.path, d.icon, d.tags, 'content' AS match_type,
      LEFT(
        REGEXP_REPLACE(dc.content, '\\\\s+', ' ', 'g'),
        1024
      ) AS content
    FROM documents d
    JOIN document_contents dc ON d.id = dc.document_id
    WHERE dc.content ILIKE '%' || ${query} || '%'
  `;

  // 5. 우선순위(title > tags > content)로 id 중복 없이 합치기
  const seen = new Set();
  const merged: any[] = [];
  for (const rows of [titleRows, tagRows, contentRows]) {
    for (const row of rows) {
      if (!seen.has(row.id)) {
        // tags 문자열 → 배열 변환
        merged.push({
          ...row,
          tags: row.tags ? row.tags.split(',') : [],
        });
        seen.add(row.id);
      }
    }
  }

  // 6. 결과 반환
  return NextResponse.json(merged);
}
