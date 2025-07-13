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
import { sql } from '@/wiki/lib/db'; // DB

/**
 * [문서 저장(생성/수정)] POST
 * - 입력: path, title, content, icon, tags(배열)
 * - 1. 필수값 누락시 400
 * - 2. path + title 기준 기존 문서 찾기
 *   - 있으면 UPDATE(메타 + 본문)
 *   - 없으면 INSERT(문서 + 본문)
 */
export async function POST(req: NextRequest) {
  try {
    const { id, path, title, content, icon, tags } = await req.json();
    console.log('[5] API로 전달된 id:', id, 'path:', path, 'title:', title);

    if (!path || !title) {
      return NextResponse.json({ error: 'path와 title은 필수입니다.' }, { status: 400 });
    }

    let documentId: number | undefined = undefined;

    // (1) 신규 생성이면, 중복 title 체크
    if (!id) {
      const dupCheck = await sql`
        SELECT id FROM documents WHERE path = ${path} AND title = ${title}
      `;
      if (dupCheck.length > 0) {
        return NextResponse.json(
          { error: '같은 카테고리(경로)에 동일한 제목의 문서가 존재합니다.' },
          { status: 409 }
        );
      }
      // 신규 INSERT
      const insertDoc = await sql`
        INSERT INTO documents (title, path, icon, tags)
        VALUES (${title}, ${path}, ${icon}, ${tags?.join(',')})
        RETURNING id
      `;
      documentId = insertDoc[0].id;
      await sql`
        INSERT INTO document_contents (document_id, content)
        VALUES (${documentId}, ${JSON.stringify(content)})
      `;
    }
    // (2) id가 있으면 무조건 UPDATE (제목도 바꿔줌)
    else {
      documentId = id;
      // UPDATE documents
      await sql`
        UPDATE documents SET
          title = ${title},
          path = ${path},
          icon = ${icon},
          tags = ${tags?.join(',')},
          updated_at = NOW()
        WHERE id = ${documentId}
      `;
      // document_contents
      const docContentRows = await sql`
        SELECT id FROM document_contents WHERE document_id = ${documentId}
      `;
      if (docContentRows.length > 0) {
        await sql`
          UPDATE document_contents SET content = ${JSON.stringify(content)} WHERE document_id = ${documentId}
        `;
      } else {
        await sql`
          INSERT INTO document_contents (document_id, content) VALUES (${documentId}, ${JSON.stringify(content)})
        `;
      }
    }

    return NextResponse.json({ success: true, id: documentId });
  } catch (err) {
    console.error('[문서 저장 API] 서버 내부 에러:', err);
    return NextResponse.json(
      { error: '서버 내부 에러', details: String(err) },
      { status: 500 }
    );
  }
}
