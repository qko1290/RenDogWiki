// =============================================
// File: app/api/villages/route.ts
// =============================================
/**
 * 마을 전체 조회/추가
 * - GET  -> name 없으면 전체 목록(order, name 순), name 있으면 단일 조회
 * - POST -> 새 마을 추가 (필수: name, icon)
 * - 응답은 실시간 갱신 성격 -> 캐시 금지
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';
import { logActivity } from '@wiki/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function strOr<T extends string | null>(v: unknown, fallback: T): T {
  if (typeof v === 'string') return (v as string).trim() as T;
  return fallback;
}
function intOr<T extends number>(v: unknown, fallback: T): T {
  const n = Number(v);
  return (Number.isFinite(n) ? Math.trunc(n) : fallback) as T;
}

/**
 * [마을 목록/단일 조회] GET
 * - name 쿼리가 없으면 전체, 있으면 단일(없으면 204)
 */
export async function GET(req: NextRequest) {
  try {
    const nameParam = req.nextUrl.searchParams.get('name');
    const name = nameParam ? nameParam.trim() : '';

    if (!name) {
      const rows = await sql/*sql*/`
        SELECT id, name, icon, "order", head_icon
        FROM village
        ORDER BY "order", name
      `;
      return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
    }

    const rows = await sql/*sql*/`
      SELECT id, name, icon, "order", head_icon
      FROM village
      WHERE name = ${name}
      LIMIT 1
    `;

    if (!Array.isArray(rows) || rows.length === 0) {
      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json(rows[0], { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[villages GET] unexpected error:', err);
    return NextResponse.json(
      { error: 'server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

/**
 * [마을 추가] POST
 * - body -> { name, icon, order?, head_icon? }
 * - 중복 이름은 409로 막아둠(단순 정책)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const name = strOr(body?.name, '');
    const icon = strOr(body?.icon, '');
    const order = intOr(body?.order, 0);
    const head_icon = body?.head_icon === undefined ? null : strOr(body?.head_icon, null);

    if (!name || !icon) {
      return NextResponse.json(
        { error: 'name, icon 필수' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // 중복 이름 방지(필요 없으면 제거 가능)
    const dup = await sql/*sql*/`
      SELECT 1 FROM village WHERE name = ${name} LIMIT 1
    `;
    if (Array.isArray(dup) && dup.length > 0) {
      return NextResponse.json(
        { error: '이미 존재하는 이름입니다.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const rows = await sql/*sql*/`
      INSERT INTO village (name, icon, "order", head_icon)
      VALUES (${name}, ${icon}, ${order}, ${head_icon})
      RETURNING id, name, icon, "order", head_icon
    `;

    // 활동 로그
    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    await logActivity({
      action: 'village.create',
      username,
      targetType: 'village',
      targetId: rows[0].id,
      targetName: rows[0].name,
      targetPath: null,
      meta: { order: rows[0].order, head_icon: rows[0].head_icon ?? null },
    });

    return NextResponse.json(rows[0], { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[villages POST] unexpected error:', err);
    return NextResponse.json(
      { error: 'server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
