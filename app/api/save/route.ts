// =============================================
// File: app/api/save/route.ts
// =============================================
/**
 * 위키 문서 저장(신규 생성 또는 수정)
 * - POST body -> { id?, path, title, content, icon?, tags? }
 * - 동작 -> 필수값 점검 -> (id 없으면) 중복 검사 후 INSERT -> (id 있으면) 충돌 검사 후 UPDATE
 *         -> document_contents에 본문 JSON 저장/갱신 -> 활동 로그 기록
 * - 주의 -> content는 JSON으로 저장, tags는 콤마(,)로 직렬화
 * - 응답은 실시간 갱신 성격 -> 캐시 금지
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 배열/문자열/객체를 안전한 JSON 값으로
function normalizeContent(v: unknown): any {
  if (v == null) return [];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return parsed ?? [];
    } catch {
      return [];
    }
  }
  return v; // 배열/객체는 그대로 저장(클라 포맷 신뢰)
}

// tags는 문자열 배열 기준으로 직렬화(트림 + 중복 제거)
function serializeTags(v: unknown): string {
  if (!Array.isArray(v)) return typeof v === 'string' ? v : '';
  const seen = new Set<string>();
  for (const it of v) {
    if (typeof it !== 'string') continue;
    const s = it.trim();
    if (!s) continue;
    seen.add(s);
  }
  return Array.from(seen).join(',');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const idRaw = body?.id;
    const idNum: number | null =
      idRaw === null || idRaw === undefined ? null : Number(idRaw);

    const titleRaw = typeof body?.title === 'string' ? body.title : '';
    const title = titleRaw.trim();

    // path는 숫자/문자열 모두 허용(스키마에 맞게 그대로 저장)
    const hasPath = Object.prototype.hasOwnProperty.call(body, 'path');
    const pathVal = body?.path;

    if (!hasPath || !pathVal || !title) {
      return NextResponse.json(
        { error: 'path와 title은 필수입니다.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const icon = typeof body?.icon === 'string' ? body.icon : '';
    const contentNorm = normalizeContent(body?.content);
    const contentJson = JSON.stringify(contentNorm);
    const tagsStr = serializeTags(body?.tags);

    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    let documentId: number;
    let created = false;

    // 신규 생성
    if (!Number.isFinite(idNum as number)) {
      // 같은 path + title 존재하면 409
      const dup = await sql/*sql*/`
        SELECT id FROM documents WHERE path = ${pathVal} AND title = ${title} LIMIT 1
      `;
      if (Array.isArray(dup) && dup.length > 0) {
        return NextResponse.json(
          { error: '같은 카테고리(경로)에 동일한 제목의 문서가 존재합니다.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const inserted = await sql/*sql*/`
        INSERT INTO documents (title, path, icon, tags)
        VALUES (${title}, ${pathVal}, ${icon}, ${tagsStr})
        RETURNING id
      `;
      documentId = Number(inserted[0].id);

      await sql/*sql*/`
        INSERT INTO document_contents (document_id, content)
        VALUES (${documentId}, ${contentJson})
      `;

      created = true;
    }
    // 기존 문서 수정
    else {
      documentId = Number(idNum);

      // path/title이 바뀌는 경우를 대비해 충돌 검사(id 제외)
      const conflict = await sql/*sql*/`
        SELECT 1 FROM documents
        WHERE path = ${pathVal} AND title = ${title} AND id <> ${documentId}
        LIMIT 1
      `;
      if (Array.isArray(conflict) && conflict.length > 0) {
        return NextResponse.json(
          { error: '같은 카테고리(경로)에 동일한 제목의 문서가 존재합니다.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      await sql/*sql*/`
        UPDATE documents SET
          title = ${title},
          path = ${pathVal},
          icon = ${icon},
          tags = ${tagsStr},
          updated_at = NOW()
        WHERE id = ${documentId}
      `;

      // 본문 존재 여부에 따라 갱신/삽입
      const exists = await sql/*sql*/`
        SELECT 1 FROM document_contents WHERE document_id = ${documentId} LIMIT 1
      `;
      if (Array.isArray(exists) && exists.length > 0) {
        await sql/*sql*/`
          UPDATE document_contents SET content = ${contentJson}
          WHERE document_id = ${documentId}
        `;
      } else {
        await sql/*sql*/`
          INSERT INTO document_contents (document_id, content)
          VALUES (${documentId}, ${contentJson})
        `;
      }
    }

    // 경로 라벨(숫자면 카테고리명으로 치환, 아니면 null 처리)
    const categoryLabel = await resolveCategoryName(
      Number.isFinite(Number(pathVal)) ? Number(pathVal) : null
    );

    await logActivity({
      action: created ? 'document.create' : 'document.update',
      username,
      targetType: 'document',
      targetId: documentId,
      targetName: title,
      targetPath: categoryLabel,
      meta: { tags: tagsStr ? tagsStr.split(',') : [], icon, created },
    });

    return NextResponse.json(
      { success: true, id: documentId },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[문서 저장 API] 서버 내부 에러:', err);
    return NextResponse.json(
      { error: '서버 내부 에러', details: String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
