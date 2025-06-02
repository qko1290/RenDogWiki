// =============================================
// File: app/api/document/route.ts
// =============================================
/**
 * 위키 문서 단일/전체 조회 API 라우트
 * - GET:
 *   전체 문서 목록 조회 : (쿼리 파라미터 all=1, 트리/목록 렌더링용)
 *   단일 문서 상세 조회 : (path=... 전달시 본문+메타데이터 동시 반환)
 * - 주요 사용처: 위키/문서 목록 페이지, 문서 상세/수정/미리보기 등
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';              // MariaDB 쿼리 유틸
import { RowDataPacket } from 'mysql2';          // 쿼리 결과 타입

export async function GET(req: NextRequest) {
  // 전체 문서 조회인지, 단일 문서서인지 구분
  const all = req.nextUrl.searchParams.get('all');
  const path = req.nextUrl.searchParams.get('path');

  // 1. 전체 문서 리스트 조회 (위키/카테고리/검색 등 트리 렌더링)
  //    - GET /api/document?all=1
  //    - 반환: [{id, title, path, icon, tags[], created_at, updated_at}, ...]
  if (all === '1') {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT id, title, path, icon, tags, created_at, updated_at FROM documents'
      );
      // tags 필드는 항상 배열로 변환
      const docs = rows.map(row => ({
        ...row,
        tags: row.tags ? row.tags.split(',') : [],
      }));
      return NextResponse.json(docs);
    } catch (err) {
      // DB 조회 실패시 서버 에러
      console.error('📛 전체 문서 리스트 조회 실패:', err);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }


  // 2. 단일 문서 상세 조회 (본문+메타데이터터, 본문은 JSON 파싱)
  //    - GET /api/document?path=...
  //    - 반환: {id, title, path, icon, tags[], created_at, updated_at, content}

  if (!path) {
    // path 미전달시 에러 응답
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  try {
    // 단일 문서 메타데이터 조회
    const [docRows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM documents WHERE path = ?',
      [path]
    );
    if (docRows.length === 0) {
      // 존재하지 않으면 204 에러 반환환
      return new NextResponse(null, { status: 204 });
    }
    const document = docRows[0];

    // 본문 테이블 조회
    const [contentRows] = await db.query<RowDataPacket[]>(
      'SELECT content FROM document_contents WHERE document_id = ?',
      [document.id]
    );
    // DB에 내용이 없으면 빈 배열 반환
    const content = contentRows[0]?.content ?? [];

    // 구조화된 데이터 객체를 반환환
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
    // DB 조회 실패시 서버 에러
    console.error('📛 문서 조회 실패:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
