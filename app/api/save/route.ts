/**
 * 위키 문서 저장(신규 생성 or 수정) API 라우트 (PostgreSQL 버전)
 * - POST:
 *   - 문서가 없으면 신규 생성
 *   - 이미 존재하면 업데이트
 *   - path+title 기준으로 유니크 판단
 *   - 본문은 document_contents 테이블에 별도 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';

export async function POST(req: NextRequest) {
  const { path, title, content, icon, tags } = await req.json();

  if (!path || !title || !content) {
    // 필수값 누락
    return NextResponse.json({ error: 'Missing field(s)' }, { status: 400 });
  }

  // 1. 기존 문서 존재 여부 확인 (path + title)
  const findResult = await db.query(
    'SELECT id FROM documents WHERE path = $1 AND title = $2',
    [path, title]
  );
  const rows = findResult.rows;
  const existing = rows[0];

  let documentId: number;

  if (existing) {
    // 2-1. 기존 문서면 UPDATE
    documentId = existing.id;

    // 메타데이터 갱신
    await db.query(
      'UPDATE documents SET title = $1, icon = $2, tags = $3, updated_at = NOW() WHERE id = $4',
      [title, icon, tags?.join(','), documentId]
    );

    // 본문 내용 갱신
    await db.query(
      'UPDATE document_contents SET content = $1 WHERE document_id = $2',
      [JSON.stringify(content), documentId]
    );
  } else {
    // 2-2. 신규 문서면 INSERT (RETURNING id)
    const insertDoc = await db.query(
      'INSERT INTO documents (title, path, icon, tags) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, path, icon, tags?.join(',')]
    );
    documentId = insertDoc.rows[0].id;

    // 본문 내용 별도 테이블에 저장
    await db.query(
      'INSERT INTO document_contents (document_id, content) VALUES ($1, $2)',
      [documentId, JSON.stringify(content)]
    );
  }

  // 3. 성공 응답
  return NextResponse.json({ success: true, id: documentId });
}
