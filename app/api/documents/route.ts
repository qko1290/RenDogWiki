// =============================================
// File: app/api/documents/route.ts
// =============================================
/**
 * 위키 문서 단일/전체 조회 API 라우트
 * - [GET]:
 *   - 전체 문서 목록 조회 : (쿼리 파라미터 all=1, 트리/목록 렌더링용)
 *   - 단일 문서 상세 조회 : (id, path, path+title 조합으로 메타+본문 동시 반환)
 * - 주요 사용처: 위키/문서 목록 페이지, 문서 상세/수정/미리보기
 * - 문서 본문은 document_contents 테이블에서 관리
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db'; // DB

/**
 * [문서 단일/전체 조회] GET
 *   1. id가 있으면 -> 단일 문서
 *   2. all=1이면 -> 전체 문서 목록
 *   3. path, title이 있으면 -> path 또는 path+title 기준 단일 문서 조회
 */
export async function GET(req: NextRequest) {
  // --- 쿼리 파라미터 추출 ---
  const all = req.nextUrl.searchParams.get('all');      // 전체 문서 조회용
  const path = req.nextUrl.searchParams.get('path');    // 단일 문서(path 기준)
  const title = req.nextUrl.searchParams.get('title');  // 단일 문서(title 옵션)
  const id = req.nextUrl.searchParams.get('id');        // 단일 문서(id 기준)

  // 1. 단일 문서 조회
  if (id) {
    try {
      // documents 테이블에서 id로 검색
      const result = await db.query(
        'SELECT * FROM documents WHERE id = $1',
        [id]
      );
      const rows = result.rows;
      if (rows.length === 0) {
        // 결과 없음
        return new NextResponse(null, { status: 204 });
      }
      const document = rows[0];

      // document_contents에서 본문 가져오기
      const contentResult = await db.query(
        'SELECT content FROM document_contents WHERE document_id = $1',
        [document.id]
      );
      const contentRows = contentResult.rows;
      // 본문 미존재시 [] 반환(빈 배열)
      const content = contentRows[0]?.content ?? [];

      return NextResponse.json({
        id: document.id,
        title: document.title,
        path: document.path,
        icon: document.icon,
        tags: document.tags ? document.tags.split(',') : [],
        created_at: document.created_at,
        updated_at: document.updated_at,
        content: typeof content === 'string' ? JSON.parse(content) : content,
      });
    } catch (err) {
      console.error('문서 ID 조회 실패:', err);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }

  // 2. 전체 문서 리스트 조회 (all=1)
  if (all === '1') {
    try {
      // 목록 조회(메타데이터만)
      const result = await db.query(
        'SELECT id, title, path, icon, tags, created_at, updated_at, is_featured FROM documents'
      );
      const rows = result.rows;
      // tags
      const docs = rows.map(row => ({
        ...row,
        tags: row.tags ? row.tags.split(',') : [],
        is_featured: Boolean(row.is_featured),
      }));
      return NextResponse.json(docs);
    } catch (err) {
      console.error(' 전체 문서 리스트 조회 실패:', err);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }

  // 3. 단일 문서 상세 조회 (path 또는 path+title)
  // path는 필수
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  try {
    let result;
    if (title) {
      // path+title 기준 조회 (중복 방지, 복수 문서 가능성 대비)
      result = await db.query(
        'SELECT * FROM documents WHERE path = $1 AND title = $2',
        [String(path), title]      // 문자열로 변환
      );
    } else {
      // path만 있을 때(대표 문서 또는 1개만 있을 때)
      result = await db.query(
        'SELECT * FROM documents WHERE path = $1',
        [String(path)]             // 문자열로 변환
      );
    }
    const docRows = result.rows;
    if (docRows.length === 0) {
      return new NextResponse(null, { status: 204 });
    }
    const document = docRows[0];

    // 본문 조회(document_contents)
    const contentResult = await db.query(
      'SELECT content FROM document_contents WHERE document_id = $1',
      [document.id]
    );
    const contentRows = contentResult.rows;
    const content = contentRows[0]?.content ?? [];

    return NextResponse.json({
      id: document.id,
      title: document.title,
      path: document.path,
      icon: document.icon,
      tags: document.tags ? document.tags.split(',') : [],
      created_at: document.created_at,
      updated_at: document.updated_at,
      content: typeof content === 'string' ? JSON.parse(content) : content,
    });
  } catch (err) {
    console.error(' 문서 조회 실패:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
