/**
 * 위키 문서 단일/전체 조회 API 라우트 (PostgreSQL 버전)
 * - GET:
 *   전체 문서 목록 조회 : (쿼리 파라미터 all=1, 트리/목록 렌더링용)
 *   단일 문서 상세 조회 : (path=... 전달시 본문+메타데이터 동시 반환)
 * - 주요 사용처: 위키/문서 목록 페이지, 문서 상세/수정/미리보기 등
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db'; // Postgres 쿼리 유틸

export async function GET(req: NextRequest) {
  // 전체 문서 조회인지, 단일 문서서인지 구분
  const all = req.nextUrl.searchParams.get('all');
  const path = req.nextUrl.searchParams.get('path');
  const title = req.nextUrl.searchParams.get('title');
  const id = req.nextUrl.searchParams.get('id');

  // 1. 단일 문서 조회 (by id)
  if (id) {
    try {
      const result = await db.query(
        'SELECT * FROM documents WHERE id = $1',
        [id]
      );
      const rows = result.rows;
      if (rows.length === 0) {
        return new NextResponse(null, { status: 204 });
      }
      const document = rows[0];

      // 본문 조회 (document_contents)
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
      console.error('문서 ID 조회 실패:', err);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }

  // 2. 전체 문서 리스트 조회
  if (all === '1') {
    try {
      const result = await db.query(
        'SELECT id, title, path, icon, tags, created_at, updated_at, is_featured FROM documents'
      );
      const rows = result.rows;
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

  // 3. 단일 문서 상세 조회 (path 또는 path+title 기준)
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  try {
    let result;
    if (title) {
      result = await db.query(
        'SELECT * FROM documents WHERE path = $1 AND title = $2',
        [String(path), title]      // ← 반드시 문자열로!
      );
    } else {
      result = await db.query(
        'SELECT * FROM documents WHERE path = $1',
        [String(path)]             // ← 반드시 문자열로!
      );
    }
    const docRows = result.rows;
    if (docRows.length === 0) {
      return new NextResponse(null, { status: 204 });
    }
    const document = docRows[0];

    // 본문 테이블 조회
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
