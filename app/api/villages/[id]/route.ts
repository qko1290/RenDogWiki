// =============================================
// File: app/api/villages/[id]/route.ts
// =============================================
/**
 * 마을 정보 수정/삭제
 * - PATCH -> { name, icon } 필수, { order, head_icon } 선택
 * - DELETE -> 단일 마을 삭제
 * - 응답은 실시간 갱신 성격이라 캐시 금지
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';
import { logActivity } from '@wiki/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 숫자 필드 정규화
function toIntOr<T extends number>(v: unknown, fallback: T): T {
  const n = Number(v);
  return (Number.isFinite(n) ? Math.trunc(n) : fallback) as T;
}
// 문자열 필드 정규화
function strOr<T extends string | null>(v: unknown, fallback: T): T {
  if (typeof v === 'string') return (v as string).trim() as T;
  return fallback;
}

/**
 * [마을 정보 수정] PATCH
 * - 입력: id(경로 파라미터), body -> { name, icon, order?, head_icon? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: 'id, name, icon 필수' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const name = strOr(body?.name, '');
    const icon = strOr(body?.icon, '');
    const order = toIntOr(body?.order, 0);
    const head_icon = body?.head_icon === undefined ? null : strOr(body?.head_icon, null);

    if (!name || !icon) {
      return NextResponse.json(
        { error: 'id, name, icon 필수' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 변경 전 데이터(없으면 404)
    const beforeRows = (await sql/*sql*/`
      SELECT id, name, icon, "order", head_icon
      FROM village
      WHERE id = ${id}
      LIMIT 1
    `) as unknown as Array<{ id: number; name: string; icon: string; order: number; head_icon: string | null }>;

    if (!beforeRows.length) {
      return NextResponse.json(
        { error: 'not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const before = beforeRows[0];

    // 업데이트
    await sql/*sql*/`
      UPDATE village
      SET
        name = ${name},
        icon = ${icon},
        "order" = ${order},
        head_icon = ${head_icon}
      WHERE id = ${id}
    `;

    // 활동 로그
    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    await logActivity({
      action: 'village.update',
      username,
      targetType: 'village',
      targetId: id,
      targetName: name,
      targetPath: null,
      meta: { before, after: { id, name, icon, order, head_icon } },
    });

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[villages PATCH] unexpected error:', err);
    return NextResponse.json(
      { error: 'server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

/**
 * [마을 삭제] DELETE
 * - 입력: id(경로 파라미터)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: 'bad id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 삭제 전 정보(없으면 404)
    const rows = (await sql/*sql*/`
      SELECT id, name
      FROM village
      WHERE id = ${id}
      LIMIT 1
    `) as unknown as Array<{ id: number; name: string | null }>;

    if (!rows.length) {
      return NextResponse.json(
        { error: 'not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const gone = rows[0];

    await sql/*sql*/`DELETE FROM village WHERE id = ${id}`;

    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    await logActivity({
      action: 'village.delete',
      username,
      targetType: 'village',
      targetId: id,
      targetName: gone.name,
      targetPath: null,
      meta: null,
    });

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[villages DELETE] unexpected error:', err);
    return NextResponse.json(
      { error: 'server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
