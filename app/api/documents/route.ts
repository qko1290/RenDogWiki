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
import { sql } from '@/wiki/lib/db'; // neon용 sql import

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
      const docs = await sql`SELECT * FROM documents WHERE id = ${id}`;
      if (docs.length === 0) {
        // 결과 없음
        return new NextResponse(null, { status: 204 });
      }
      const document = docs[0];

      // document_contents에서 본문 가져오기
      const contentRows = await sql`SELECT content FROM document_contents WHERE document_id = ${document.id}`;
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
      const docs = await sql`SELECT id, title, path, icon, tags, created_at, updated_at, is_featured FROM documents`;
      // tags
      const result = docs.map((row: any) => ({
        ...row,
        tags: row.tags ? row.tags.split(',') : [],
        is_featured: Boolean(row.is_featured),
      }));
      return NextResponse.json(result);
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
    let docs;
    if (title) {
      // path+title 기준 조회 (중복 방지, 복수 문서 가능성 대비)
      docs = await sql`SELECT * FROM documents WHERE path = ${String(path)} AND title = ${title}`;
    } else {
      // path만 있을 때(대표 문서 또는 1개만 있을 때)
      docs = await sql`SELECT * FROM documents WHERE path = ${String(path)}`;
    }
    if (docs.length === 0) {
      return new NextResponse(null, { status: 204 });
    }
    const document = docs[0];

    // 본문 조회(document_contents)
    const contentRows = await sql`SELECT content FROM document_contents WHERE document_id = ${document.id}`;
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

export async function DELETE(req: NextRequest) {
  // id 파라미터 추출 (쿼리스트링에서)
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    // 1. 문서 본문 삭제 (document_contents)
    await sql`DELETE FROM document_contents WHERE document_id = ${id}`;
    // 2. 문서 메타 삭제 (documents)
    await sql`DELETE FROM documents WHERE id = ${id}`;
    return NextResponse.json({ message: 'deleted' });
  } catch (err) {
    console.error('문서 삭제 실패:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
