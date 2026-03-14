// =============================================
// File: app/api/documents/route.ts
// (전체 코드)
// - 문서 단건 / 목록 / 전체 조회 / 삭제
// - 단건은 documents + document_contents JOIN 1회 조회
// - list/all 은 로컬 TTL 캐시 사용
// - detail 은 항상 직접 조회(no-store)
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';
import { getAuthUser } from '@/wiki/lib/auth';
import { cached, cacheKey, invalidate } from '@wiki/lib/cache';
import { requireRole } from '@/app/wiki/lib/requireRole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const docTag = (id: number) => `doc:${id}`;
const listTag = (p: string | number) => `doclist:${String(p)}`;

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  };
}

function splitTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((v) => v.trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

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

async function getDocById(id: number) {
  const rows = await sql`
    SELECT
      d.id,
      d.title,
      d.path,
      d.icon,
      d.tags,
      d.created_at,
      d.updated_at,
      d.special,
      d."order",
      dc.content
    FROM documents d
    LEFT JOIN document_contents dc
      ON dc.document_id = d.id
    WHERE d.id = ${id}
    LIMIT 1
  `;

  const row = rows?.[0];
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    path: row.path,
    icon: row.icon,
    tags: splitTags(row.tags),
    created_at: row.created_at,
    updated_at: row.updated_at,
    special: row.special ?? null,
    order: Number(row.order ?? 0),
    content: toContentArray(row.content ?? []),
  };
}

async function getDocByPathAndTitle(path: string, title?: string) {
  const rows = title
    ? await sql`
        SELECT
          d.id,
          d.title,
          d.path,
          d.icon,
          d.tags,
          d.created_at,
          d.updated_at,
          d.special,
          d."order",
          dc.content
        FROM documents d
        LEFT JOIN document_contents dc
          ON dc.document_id = d.id
        WHERE d.path = ${path}
          AND d.title = ${title}
        LIMIT 1
      `
    : await sql`
        SELECT
          d.id,
          d.title,
          d.path,
          d.icon,
          d.tags,
          d.created_at,
          d.updated_at,
          d.special,
          d."order",
          dc.content
        FROM documents d
        LEFT JOIN document_contents dc
          ON dc.document_id = d.id
        WHERE d.path = ${path}
        ORDER BY d.is_featured DESC, d."order" ASC, d.updated_at DESC, d.id DESC
        LIMIT 1
      `;

  const row = rows?.[0];
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    path: row.path,
    icon: row.icon,
    tags: splitTags(row.tags),
    created_at: row.created_at,
    updated_at: row.updated_at,
    special: row.special ?? null,
    order: Number(row.order ?? 0),
    content: toContentArray(row.content ?? []),
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // 경로별 리스트
  if (sp.get('list') === '1') {
    try {
      const pathParam = (sp.get('path') ?? '0').trim();
      const pathNorm = pathParam === '' ? '0' : pathParam;

      const data = await cached(
        cacheKey('doclist', pathNorm),
        {
          ttlSec: 30,
          tags: ['doc:list', listTag(pathNorm)],
        },
        async () => {
          let mainDocId: number | null = null;

          try {
            if (/^\d+$/.test(pathNorm)) {
              const r = await sql`
                SELECT document_id
                FROM categories
                WHERE id = ${Number(pathNorm)}
                LIMIT 1
              `;
              mainDocId = r?.[0]?.document_id ?? null;
            } else {
              const r = await sql`
                SELECT document_id
                FROM categories
                WHERE name = ${pathNorm}
                LIMIT 1
              `;
              mainDocId = r?.[0]?.document_id ?? null;
            }
          } catch {
            // category 대표 문서 조회 실패는 목록 자체를 막지 않음
            mainDocId = null;
          }

          const rows = await sql`
            SELECT
              id,
              title,
              path,
              icon,
              tags,
              created_at,
              updated_at,
              is_featured,
              special,
              "order"
            FROM documents
            WHERE path = ${pathNorm}
              AND (${mainDocId}::int IS NULL OR id <> ${mainDocId})
            ORDER BY "order" ASC, updated_at DESC, id DESC
          `;

          const items = rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            icon: r.icon,
            tags: splitTags(r.tags),
            created_at: r.created_at,
            updated_at: r.updated_at,
            special: r.special ?? null,
            is_featured: Boolean(r.is_featured),
            order: Number(r.order ?? 0),
            is_main: mainDocId != null && Number(mainDocId) === Number(r.id),
          }));

          return {
            items,
            main_document_id: mainDocId,
          };
        }
      );

      return NextResponse.json(data, { headers: noStoreHeaders() });
    } catch (e) {
      console.error('문서 경로별 목록 실패:', e);
      return NextResponse.json(
        { error: 'Server error' },
        { status: 500, headers: noStoreHeaders() }
      );
    }
  }

  const all = sp.get('all');
  const pathRaw = sp.get('path');
  const titleRaw = sp.get('title');
  const idRaw = sp.get('id');

  // id 단건
  if (idRaw) {
    try {
      const id = Number(idRaw);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json(
          { error: 'Invalid id' },
          { status: 400, headers: noStoreHeaders() }
        );
      }

      const data = await getDocById(id);
      if (!data) {
        return new NextResponse(null, {
          status: 204,
          headers: noStoreHeaders(),
        });
      }

      return NextResponse.json(data, { headers: noStoreHeaders() });
    } catch (e) {
      console.error('[documents GET by id] error:', e);
      return NextResponse.json(
        { error: 'Server error' },
        { status: 500, headers: noStoreHeaders() }
      );
    }
  }

  // 전체
  if (all === '1') {
    try {
      const result = await cached(
        'doc:all:v2',
        { ttlSec: 60, tags: ['doc:list'] },
        async () => {
          const rows = await sql`
            SELECT
              id,
              title,
              path,
              icon,
              tags,
              created_at,
              updated_at,
              is_featured,
              special,
              "order"
            FROM documents
          `;

          return rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            icon: r.icon,
            tags: splitTags(r.tags),
            created_at: r.created_at,
            updated_at: r.updated_at,
            is_featured: Boolean(r.is_featured),
            special: r.special ?? null,
            order: Number(r.order ?? 0),
          }));
        }
      );

      return NextResponse.json(result, { headers: noStoreHeaders() });
    } catch (e) {
      console.error('[documents GET all] error:', e);
      return NextResponse.json(
        { error: 'Server error' },
        { status: 500, headers: noStoreHeaders() }
      );
    }
  }

  // path(+title) 단건
  const path = (pathRaw ?? '').trim();
  if (!path) {
    return NextResponse.json(
      { error: 'Missing path' },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  try {
    const title = (titleRaw ?? '').trim();
    const data = await getDocByPathAndTitle(path, title || undefined);

    if (!data) {
      return new NextResponse(null, {
        status: 204,
        headers: noStoreHeaders(),
      });
    }

    return NextResponse.json(data, { headers: noStoreHeaders() });
  } catch (e) {
    console.error('[documents GET by path/title] error:', e);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireRole(['writer', 'admin']);

  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { 'content-type': 'application/json' },
    });
  }

  const sp = req.nextUrl.searchParams;
  const idRaw = sp.get('id');

  if (!idRaw) {
    return NextResponse.json(
      { error: 'Missing id' },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  try {
    const id = Number(idRaw);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: 'Invalid id' },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const before = await sql`
      SELECT id, title, path, tags
      FROM documents
      WHERE id = ${id}
      LIMIT 1
    `;

    const doc = before[0];
    if (!doc) {
      return NextResponse.json(
        { error: 'not found' },
        { status: 404, headers: noStoreHeaders() }
      );
    }

    await sql`DELETE FROM document_contents WHERE document_id = ${id}`;
    await sql`DELETE FROM documents WHERE id = ${id}`;

    invalidate(docTag(id), 'doc:list', listTag(doc?.path));

    const user = getAuthUser();
    const username = gate.dbUser.minecraft_name || gate.dbUser.username || 'unknown';

    let targetPathLabel: string | null = null;
    const p = doc?.path;

    if (p === 0 || p === '0') targetPathLabel = '루트 카테고리';
    else if (p == null) targetPathLabel = '루트 카테고리';
    else if (/^\d+$/.test(String(p))) targetPathLabel = await resolveCategoryName(Number(p));
    else targetPathLabel = String(p);

    await logActivity({
      action: 'document.delete',
      username,
      targetType: 'document',
      targetId: id,
      targetName: doc?.title ?? null,
      targetPath: targetPathLabel,
      meta: { tags: doc?.tags ?? null },
    });

    return NextResponse.json(
      { message: 'deleted' },
      { headers: noStoreHeaders() }
    );
  } catch (e) {
    console.error('[documents DELETE] error:', e);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}