// app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';
import { getAuthUser } from '@/wiki/lib/auth';

export const runtime = 'nodejs';

function toContentArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const all = sp.get('all');
  const pathRaw = sp.get('path');
  const titleRaw = sp.get('title');
  const idRaw = sp.get('id');

  // id로 단건
  if (idRaw) {
    try {
      const id = Number(idRaw);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
      const rows = await sql`
        SELECT id, title, path, icon, tags, created_at, updated_at, special
        FROM documents
        WHERE id = ${id}
        LIMIT 1
      `;
      const doc = rows[0];
      if (!doc) return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

      const bodyRows = await sql`SELECT content FROM document_contents WHERE document_id = ${doc.id} LIMIT 1`;
      const content = toContentArray(bodyRows[0]?.content ?? []);

      return NextResponse.json(
        {
          id: doc.id,
          title: doc.title,
          path: doc.path,
          icon: doc.icon,
          tags: doc.tags ? String(doc.tags).split(',') : [],
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          special: doc.special ?? null,
          content,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // 전체 목록
  if (all === '1') {
    try {
      const rows = await sql`
        SELECT id, title, path, icon, tags, created_at, updated_at, is_featured, special
        FROM documents
      `;
      const result = rows.map((r: any) => ({
        ...r,
        tags: r.tags ? String(r.tags).split(',') : [],
        is_featured: Boolean(r.is_featured),
        special: r.special ?? null,
      }));
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
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
    const rows = title
      ? await sql`
          SELECT id, title, path, icon, tags, created_at, updated_at, special
          FROM documents
          WHERE path = ${path} AND title = ${title}
          LIMIT 1
        `
      : await sql`
          SELECT id, title, path, icon, tags, created_at, updated_at, special
          FROM documents
          WHERE path = ${path}
          LIMIT 1
        `;
    const doc = rows[0];
    if (!doc) return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

    const bodyRows = await sql`SELECT content FROM document_contents WHERE document_id = ${doc.id} LIMIT 1`;
    const content = toContentArray(bodyRows[0]?.content ?? []);

    return NextResponse.json(
      {
        id: doc.id,
        title: doc.title,
        path: doc.path,
        icon: doc.icon,
        tags: doc.tags ? String(doc.tags).split(',') : [],
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        special: doc.special ?? null,
        content,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const idRaw = sp.get('id');
  if (!idRaw) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  try {
    const id = Number(idRaw);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

    const before = await sql`
      SELECT id, title, path, tags
      FROM documents
      WHERE id = ${id}
      LIMIT 1
    `;
    const doc = before[0];
    if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    await sql`DELETE FROM document_contents WHERE document_id = ${id}`;
    await sql`DELETE FROM documents WHERE id = ${id}`;

    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    let targetPathLabel: string | null = null;
    const p = doc?.path;
    if (p == null) targetPathLabel = '루트 카테고리';
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
