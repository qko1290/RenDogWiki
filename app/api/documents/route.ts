// C:\next\rdwiki\app\api\documents\route.ts

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

function toContentArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function getDocByIdCached(id: number) {
  return cached(
    cacheKey('doc', id),
    { ttlSec: 0, tags: [docTag(id)] }, // ★ 단건은 항상 최신
    async () => {
      const rows = await sql/*sql*/`
        SELECT id, title, path, icon, tags, created_at, updated_at, special, "order"
        FROM documents
        WHERE id = ${id}
        LIMIT 1
      `;
      const doc = rows[0];
      if (!doc) return null;

      const bodyRows = await sql/*sql*/`
        SELECT content FROM document_contents WHERE document_id = ${id} LIMIT 1
      `;
      const content = toContentArray(bodyRows[0]?.content ?? []);

      return {
        id: doc.id,
        title: doc.title,
        path: doc.path,
        icon: doc.icon,
        tags: doc.tags ? String(doc.tags).split(',') : [],
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        special: doc.special ?? null,
        order: Number(doc.order ?? 0),
        content,
      };
    }
  );
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
        { ttlSec: 0, tags: ['doc:list', listTag(pathNorm)] }, // ★ 즉시 반영
        async () => {
          let mainDocId: number | null = null;
          try {
            if (/^\d+$/.test(pathNorm)) {
              const r = await sql`SELECT document_id FROM categories WHERE id = ${Number(pathNorm)} LIMIT 1`;
              mainDocId = r?.[0]?.document_id ?? null;
            } else {
              const r = await sql`SELECT document_id FROM categories WHERE name = ${pathNorm} LIMIT 1`;
              mainDocId = r?.[0]?.document_id ?? null;
            }
          } catch {}

          const rows = (await sql/*sql*/`
            SELECT id, title, path, icon, tags, created_at, updated_at, is_featured, special, "order"
            FROM documents
            WHERE path = ${pathNorm}
              AND (${mainDocId}::int IS NULL OR id <> ${mainDocId})
            ORDER BY "order" ASC, updated_at DESC, id DESC
          `) as any[];

          const items = rows.map((r) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            icon: r.icon,
            tags: r.tags ? String(r.tags).split(',') : [],
            created_at: r.created_at,
            updated_at: r.updated_at,
            special: r.special ?? null,
            is_featured: Boolean(r.is_featured),
            order: Number(r.order ?? 0),
            is_main: mainDocId != null && Number(mainDocId) === Number(r.id),
          }));

          return { items, main_document_id: mainDocId };
        }
      );

      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      });
    } catch (e) {
      console.error('문서 경로별 목록 실패:', e);
      return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
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
        return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }

      const data = await getDocByIdCached(id);
      if (!data) return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // 전체
  if (all === '1') {
    try {
      const result = await cached(
        'doc:all',
        { ttlSec: 0, tags: ['doc:list'] }, // ★ 즉시 반영
        async () => {
          const rows = await sql/*sql*/`
            SELECT id, title, path, icon, tags, created_at, updated_at, is_featured, special, "order"
            FROM documents
          `;
          return rows.map((r: any) => ({
            ...r,
            tags: r.tags ? String(r.tags).split(',') : [],
            is_featured: Boolean(r.is_featured),
            special: r.special ?? null,
            order: Number(r.order ?? 0),
          }));
        }
      );

      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }, // ★ 실시간
      });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // path(+title) 단건
  const path = (pathRaw ?? '').trim();
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  try {
    const title = (titleRaw ?? '').trim();

    const row = title
      ? (await sql/*sql*/`
          SELECT id FROM documents WHERE path = ${path} AND title = ${title} LIMIT 1
        `)[0]
      : (await sql/*sql*/`
          SELECT id FROM documents WHERE path = ${path} LIMIT 1
        `)[0];

    if (!row?.id) return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

    const data = await getDocByIdCached(Number(row.id));

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
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
  if (!idRaw) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  try {
    const id = Number(idRaw);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const before = await sql/*sql*/`
      SELECT id, title, path, tags
      FROM documents
      WHERE id = ${id}
      LIMIT 1
    `;
    const doc = before[0];
    if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    await sql/*sql*/`DELETE FROM document_contents WHERE document_id = ${id}`;
    await sql/*sql*/`DELETE FROM documents WHERE id = ${id}`;

    // ✅ 캐시 무효화
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

    return NextResponse.json({ message: 'deleted' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
