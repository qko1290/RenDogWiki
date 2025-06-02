// File: app/api/document/save/route.ts

/**
 * 위키 문서 저장(신규 생성 or 수정) API 라우트
 * - POST:
 *   - 문서가 없으면 신규 생성
 *   - 이미 존재하면 업데이트
 * - 사용처: 위키 문서 에디터(저장 버튼), 관리자용 문서 관리
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db'; // MariaDB 쿼리
import { RowDataPacket, OkPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  const { path, title, content, icon, tags } = await req.json();

  if (!path || !title || !content) {
    // path, title, content가 없으면 400 에러
    return NextResponse.json({ error: 'Missing field(s)' }, { status: 400 });
  }

  // path는 유니크 값 -> 같은 path가 있으면 업데이트, 없으면 새로 생성
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id FROM documents WHERE path = ? AND title = ?',
    [path, title]
  );
  const existing = rows[0] as { id: number } | undefined;

  let documentId: number;

  if (existing) {
    // 기존 문서 업데이트
    documentId = existing.id;

    // 메타데이터 갱신
    await db.query(
      'UPDATE documents SET title = ?, icon = ?, tags = ?, updated_at = NOW() WHERE id = ?',
      [title, icon, tags?.join(','), documentId]
    );

    // 본문 내용 갱신
    await db.query(
      'UPDATE document_contents SET content = ? WHERE document_id = ?',
      [JSON.stringify(content), documentId]
    );
  } else {
    // 신규 문서 생성
    // documents에 기본정보 등록
    const [docResult] = await db.query<OkPacket>(
      'INSERT INTO documents (title, path, icon, tags) VALUES (?, ?, ?, ?)',
      [title, path, icon, tags?.join(',')]
    );
    documentId = docResult.insertId;

    // 본문 내용 별도 테이블에 저장
    await db.query(
      'INSERT INTO document_contents (document_id, content) VALUES (?, ?)',
      [documentId, JSON.stringify(content)]
    );
  }

  return NextResponse.json({ success: true, id: documentId });
}
