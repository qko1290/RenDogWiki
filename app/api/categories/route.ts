// =============================================
// File: app/api/categories/route.ts
// =============================================
/**
 * 카테고리 전체 조회/생성 API
 * - GET  -> 모든 카테고리 목록을 parent_id, "order" 순으로 반환
 * - POST -> 신규 카테고리 생성(name 필수, parent/document/icon 선택)
 * - 메모: "order"는 Postgres 예약어라 항상 쌍따옴표 필요
 */

import { sql } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';
import { getAuthUser } from '@/wiki/lib/auth';

// 숫자/문자/널 입력을 정수 또는 null로 정규화
function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function GET() {
  try {
    // 전체 row를 parent_id, "order" 기준으로 정렬해서 반환
    const rows = await sql`
      SELECT * FROM categories
      ORDER BY parent_id, "order"
    `;
    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[categories GET] unexpected error:', err);
    return NextResponse.json(
      { error: '카테고리 목록을 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1) 입력 파싱
    const body = await req.json().catch(() => null);
    const rawName = typeof body?.name === 'string' ? body.name : '';
    const name = rawName.trim();
    const parent_id = toNullableInt(body?.parent_id);
    const document_id = toNullableInt(body?.document_id);
    const icon =
      typeof body?.icon === 'string' && body.icon.trim() !== ''
        ? body.icon.trim()
        : null;

    // 2) 필수값(name) 확인
    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3) 같은 parent 내 다음 order 계산 -> MAX("order") + 1
    let nextOrder = 0;
    const orderResult = (await sql`
      SELECT MAX("order") AS max_order
      FROM categories
      WHERE parent_id ${parent_id === null ? sql`IS NULL` : sql`= ${parent_id}`}
    `) as unknown as Array<{ max_order: number | string | null }>;

    const maxOrder = orderResult?.[0]?.max_order;
    if (maxOrder !== null && maxOrder !== undefined) {
      const parsed = Number(maxOrder);
      nextOrder = Number.isFinite(parsed) ? parsed + 1 : 0;
    }

    // 4) INSERT -> 새 id 반환
    const insertRows = (await sql`
      INSERT INTO categories (name, parent_id, "order", document_id, icon)
      VALUES (${name}, ${parent_id}, ${nextOrder}, ${document_id}, ${icon})
      RETURNING id
    `) as unknown as Array<{ id: number | string }>;
    const newId = Number(insertRows?.[0]?.id);

    // 5) 활동 로그(부모 라벨은 사람이 읽을 수 있게)
    const user = getAuthUser();
    const username =
      user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;
    const parentLabel = await resolveCategoryName(parent_id);

    await logActivity({
      action: 'category.create',
      username,
      targetType: 'category',
      targetId: newId,
      targetName: name,
      targetPath: parentLabel,
      meta: {
        parent_id,
        order: nextOrder,
        document_id: document_id ?? null,
        icon: icon ?? null,
      },
    });

    // 6) 생성된 id 반환
    return NextResponse.json(
      { id: newId },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[categories POST] unexpected error:', err);
    return NextResponse.json(
      { error: '카테고리 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
