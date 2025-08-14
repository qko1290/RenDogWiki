// File: app/api/documents/route.ts
/**
 * 위키 문서 단일/전체 조회 및 삭제
 * - GET
 *   - id -> 단일 문서 메타 + 본문
 *   - all=1 -> 전체 문서 메타 목록(트리/드롭다운용)
 *   - path(필수), title(선택) -> 조건에 맞는 단일 문서
 * - DELETE
 *   - id(필수) -> 본문(document_contents) -> 메타(documents) 순서로 삭제하고 활동 로그 남김
 * - 메모: 본문은 document_contents 테이블에서 관리, content는 JSON 문자열일 수 있음 -> 파싱 필요
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';
import { getAuthUser } from '@/wiki/lib/auth';

export const runtime = 'nodejs';

// content 컬럼을 안전하게 배열로 변환 -> 문자열이면 JSON.parse, 실패하면 빈 배열
function toContentArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function GET(req: NextRequest) {
  // 쿼리 파라미터 추출
  const sp = req.nextUrl.searchParams;
  const all = sp.get('all');
  const pathRaw = sp.get('path');
  const titleRaw = sp.get('title');
  const idRaw = sp.get('id');

  // 1) id 기준 단일 조회
  if (idRaw) {
    try {
      const idNum = Number(idRaw);
      if (!Number.isFinite(idNum) || idNum <= 0) {
        return NextResponse.json(
          { error: 'Invalid id' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
        }

      // 필요한 컬럼만 조회
      const docs = (await sql`
        SELECT id, title, path, icon, tags, created_at, updated_at
        FROM documents
        WHERE id = ${idNum}
        LIMIT 1
      `) as unknown as Array<any>;

      if (!Array.isArray(docs) || docs.length === 0) {
        return new NextResponse(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      const document = docs[0];

      // 본문 조회
      const contentRows = (await sql`
        SELECT content FROM document_contents WHERE document_id = ${document.id} LIMIT 1
      `) as unknown as Array<{ content: unknown }>;
      const content = toContentArray(contentRows[0]?.content ?? []);

      return NextResponse.json(
        {
          id: document.id,
          title: document.title,
          path: document.path,
          icon: document.icon,
          tags: document.tags ? String(document.tags).split(',') : [],
          created_at: document.created_at,
          updated_at: document.updated_at,
          content,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (err) {
      console.error('문서 ID 조회 실패:', err);
      return NextResponse.json(
        { error: 'Server error' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  // 2) 전체 문서 목록(all=1)
  if (all === '1') {
    try {
      const docs = (await sql`
        SELECT id, title, path, icon, tags, created_at, updated_at, is_featured
        FROM documents
      `) as unknown as Array<any>;

      const result = docs.map((row) => ({
        ...row,
        tags: row.tags ? String(row.tags).split(',') : [],
        is_featured: Boolean(row.is_featured),
      }));

      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch (err) {
      console.error('전체 문서 리스트 조회 실패:', err);
      return NextResponse.json(
        { error: 'Server error' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  // 3) path(+title) 단일 조회
  const path = (pathRaw ?? '').trim();
  if (!path) {
    return NextResponse.json(
      { error: 'Missing path' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const title = (titleRaw ?? '').trim();
    const docs = title
      ? ((await sql`
          SELECT id, title, path, icon, tags, created_at, updated_at
          FROM documents
          WHERE path = ${path} AND title = ${title}
          LIMIT 1
        `) as unknown as Array<any>)
      : ((await sql`
          SELECT id, title, path, icon, tags, created_at, updated_at
          FROM documents
          WHERE path = ${path}
          LIMIT 1
        `) as unknown as Array<any>);

    if (!Array.isArray(docs) || docs.length === 0) {
      return new NextResponse(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const document = docs[0];
    const contentRows = (await sql`
      SELECT content FROM document_contents WHERE document_id = ${document.id} LIMIT 1
    `) as unknown as Array<{ content: unknown }>;
    const content = toContentArray(contentRows[0]?.content ?? []);

    return NextResponse.json(
      {
        id: document.id,
        title: document.title,
        path: document.path,
        icon: document.icon,
        tags: document.tags ? String(document.tags).split(',') : [],
        created_at: document.created_at,
        updated_at: document.updated_at,
        content,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('문서 조회 실패:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

/**
 * 문서 삭제
 * - 쿼리스트링 id 필수 -> 문서 본문을 먼저 지우고, 이후 메타 삭제
 * - 활동 로그에 사람이 읽는 경로 라벨을 남김 -> 숫자면 카테고리 이름으로 해석
 */
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const idRaw = sp.get('id');

  if (!idRaw) {
    return NextResponse.json(
      { error: 'Missing id' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const idNum = Number(idRaw);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 삭제 전 메타 조회(로그용)
    const rows = (await sql`
      SELECT id, title, path, tags
      FROM documents
      WHERE id = ${idNum}
      LIMIT 1
    `) as unknown as Array<{ id: number; title: string | null; path: any; tags: string | null }>;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const doc = rows[0];

    // 본문 -> 메타 순서대로 삭제
    await sql`DELETE FROM document_contents WHERE document_id = ${idNum}`;
    await sql`DELETE FROM documents WHERE id = ${idNum}`;

    // 활동 로그용 라벨 계산
    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    let targetPathLabel: string | null = null;
    if (doc?.path === null || doc?.path === undefined) {
      targetPathLabel = '루트 카테고리';
    } else {
      const p = String(doc.path);
      if (/^\d+$/.test(p)) {
        targetPathLabel = await resolveCategoryName(Number(p));
      } else {
        targetPathLabel = p; // 슬러그/텍스트 경로는 그대로 사용
      }
    }

    await logActivity({
      action: 'document.delete',
      username,
      targetType: 'document',
      targetId: idNum,
      targetName: doc?.title ?? null,
      targetPath: targetPathLabel,
      meta: {
        tags: doc?.tags ?? null,
      },
    });

    return NextResponse.json(
      { message: 'deleted' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('문서 삭제 실패:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
