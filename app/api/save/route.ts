// =============================================
// File: app/api/save/route.ts
// =============================================
/**
 * 위키 문서 저장(신규 생성 or 수정) API
 * - [POST] path, title, content, icon, tags 등을 전달 받음
 *   - path + title 조합으로 문서 존재 여부 판별(유니크 키)
 *   - 없으면 신규 생성, 있으면 UPDATE (메타 + 본문)
 *   - 본문은 document_contents 테이블에 별도 저장(JSON)
 * - 에러: 필수값 누락(400)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db'; // DB

/**
 * [문서 저장(생성/수정)] POST
 * - 입력: path, title, content, icon, tags(배열)
 * - 1. 필수값 누락시 400
 * - 2. path + title 기준 기존 문서 찾기
 *   - 있으면 UPDATE(메타 + 본문)
 *   - 없으면 INSERT(문서 + 본문)
 */
export async function POST(req: NextRequest) {
  // 1. 입력값 파싱 및 필수값 체크
  const { path, title, content, icon, tags } = await req.json();

  if (!path || !title || !content) {
    // 필수값 누락시 400
    return NextResponse.json({ error: 'Missing field(s)' }, { status: 400 });
  }

  // 2. 기존 문서 존재 여부 확인 (path + title)
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

    // 문서 메타데이터 갱신
    await db.query(
      'UPDATE documents SET title = $1, icon = $2, tags = $3, updated_at = NOW() WHERE id = $4',
      [title, icon, tags?.join(','), documentId]
    );

    // 본문 갱신(document_contents 테이블)
    await db.query(
      'UPDATE document_contents SET content = $1 WHERE document_id = $2',
      [JSON.stringify(content), documentId]
    );
  } else {
    // 2-2. 신규 문서면 INSERT
    const insertDoc = await db.query(
      'INSERT INTO documents (title, path, icon, tags) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, path, icon, tags?.join(',')]
    );
    documentId = insertDoc.rows[0].id;

    // 본문은 별도 테이블에 저장
    await db.query(
      'INSERT INTO document_contents (document_id, content) VALUES ($1, $2)',
      [documentId, JSON.stringify(content)]
    );
  }

  // 3. 성공 응답
  return NextResponse.json({ success: true, id: documentId });
}
