// app/api/documents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';

export const runtime = 'nodejs';

// POST: 부분 업데이트(주로 order 재정렬용)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const body = await req.json().catch(() => ({} as any));
    const order = body?.order != null ? Math.max(0, Number(body.order)) : null;

    if (order == null || !Number.isFinite(order)) {
      return NextResponse.json({ error: 'Missing order' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const before = await sql/*sql*/`
      SELECT id, title, path, "order"
      FROM documents
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!before?.length) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    await sql/*sql*/`
      UPDATE documents
      SET "order" = ${order}, updated_at = NOW()
      WHERE id = ${id}
    `;

    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;
    const targetPath = await resolveCategoryName(/^\d+$/.test(String(before[0].path)) ? Number(before[0].path) : null);

    await logActivity({
      action: 'document.update',            // 정렬도 업데이트로 기록
      username,
      targetType: 'document',
      targetId: id,
      targetName: before[0].title,
      targetPath,
      meta: { kind: 'reorder', order },
    });

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[documents/:id POST] error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

// PUT: 경로(path) 이동(Shift 드롭)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const body = await req.json().catch(() => ({} as any));

    // 요구사항: path만 이동용으로 사용 (그 외는 무시)
    if (body?.path === undefined || body?.path === null || String(body.path).trim() === '') {
      return NextResponse.json({ error: 'Missing path' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const newPath: string = String(body.path).trim();

    // 기존 값
    const before = await sql/*sql*/`
      SELECT id, title, path
      FROM documents
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!before?.length) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    const oldPath = String(before[0].path);

    // 새 경로에서 맨 뒤로(=가장 큰 order + 1)
    const next = await sql/*sql*/`
      SELECT COALESCE(MAX("order"), -1) + 1 AS next
      FROM documents
      WHERE path = ${newPath}
    `;
    const nextOrder = Number(next?.[0]?.next ?? 0);

    await sql/*sql*/`
      UPDATE documents
      SET path = ${newPath}, "order" = ${nextOrder}, updated_at = NOW()
      WHERE id = ${id}
    `;

    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    const fromLabel = await resolveCategoryName(/^\d+$/.test(oldPath) ? Number(oldPath) : null);
    const toLabel   = await resolveCategoryName(/^\d+$/.test(newPath) ? Number(newPath) : null);

    await logActivity({
      action: 'document.update',
      username,
      targetType: 'document',
      targetId: id,
      targetName: before[0].title,
      targetPath: toLabel,
      meta: { kind: 'move', from: fromLabel ?? oldPath, to: toLabel ?? newPath },
    });

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[documents/:id PUT] error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
