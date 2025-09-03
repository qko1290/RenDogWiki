/**
 * 카테고리 단건에 대한 수정/삭제/정렬 API
 * - PUT  -> 카테고리 정보 수정(name/parent_id/order/document_id/icon/mode_tags)
 * - DELETE -> 재귀적으로 하위 카테고리와 그 안의 문서/본문 삭제
 * - POST -> 드래그 앤 드롭 결과를 반영해 order만 갱신
 * - 참고: 활동 로그는 사람이 읽을 수 있는 라벨로 남김 -> resolveCategoryName 사용
 */

import { sql } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';
import { getAuthUser } from '@/wiki/lib/auth';
import { invalidate } from '@/wiki/lib/cache';

export const runtime = 'nodejs';

// 문자열/숫자/널을 받아 정수 또는 null로 정규화
function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// 숫자처럼 보이면 정수, 아니면 기본값
function toIntOrDefault(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const idNum = Number(params.id);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json(
        { error: 'invalid category id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const body = await req.json().catch(() => null);
    const rawName = typeof body?.name === 'string' ? body.name : '';
    const name = rawName.trim();

    const parent_id = body?.parent_id;
    const order = body?.order;
    const document_id = body?.document_id;
    const icon = typeof body?.icon === 'string' && body.icon !== '' ? body.icon : null;

    // mode_tags 파싱(소문자/공백정리/중복제거)
    const mode_tags: string[] = Array.isArray(body?.mode_tags)
      ? Array.from(
          new Set(
            body.mode_tags
              .map((s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : ''))
              .filter(Boolean)
          )
        )
      : [];

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const parentIdFixed = toNullableInt(parent_id);
    const orderFixed = toIntOrDefault(order, 0);
    const documentIdFixed = toNullableInt(document_id);

    if (parentIdFixed !== null && parentIdFixed === idNum) {
      return NextResponse.json(
        { error: 'parent_id cannot be the same as id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    await sql`
      UPDATE categories SET
        name = ${name},
        parent_id = ${parentIdFixed},
        "order" = ${orderFixed},
        document_id = ${documentIdFixed},
        icon = ${icon},
        mode_tags = ${mode_tags}::text[]
      WHERE id = ${idNum}
    `;

    // ✅ 캐시 무효화
    invalidate('category:list', 'category:tree', 'category:modes', `category:${idNum}`);

    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;
    const parentLabel = await resolveCategoryName(parentIdFixed);

    await logActivity({
      action: 'category.update',
      username,
      targetType: 'category',
      targetId: idNum,
      targetName: name,
      targetPath: parentLabel,
      meta: {
        parent_id: parentIdFixed,
        order: orderFixed,
        document_id: documentIdFixed,
        icon,
        mode_tags,
      },
    });

    return NextResponse.json({ message: 'updated' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[categories:id PUT] unexpected error:', err);
    return NextResponse.json(
      { error: '카테고리 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const idNum = Number(params.id);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json(
        { error: 'invalid category id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 재귀적으로 자신 포함 모든 하위 카테고리 id 수집
    const subCatResult = (await sql`
      WITH RECURSIVE subcategories AS (
        SELECT id FROM categories WHERE id = ${idNum}
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN subcategories sc ON c.parent_id = sc.id
      )
      SELECT id FROM subcategories
    `) as unknown as { id: number }[];

    const catIds = (subCatResult || []).map((r) => r.id);
    if (catIds.length === 0) {
      return NextResponse.json(
        { message: 'not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 루트 카테고리의 이름/부모 라벨(로그용)
    const rootRow = (await sql`
      SELECT id, name, parent_id
      FROM categories
      WHERE id = ${idNum}
      LIMIT 1
    `) as unknown as { id: number; name: string | null; parent_id: number | null }[];
    const rootName = rootRow[0]?.name ?? null;
    const parentLabel = await resolveCategoryName(rootRow[0]?.parent_id ?? null);

    // 해당 경로(catIds)에 속한 문서 id 수집
    const docResult = (await sql`
      SELECT id FROM documents WHERE path = ANY(${catIds})
    `) as unknown as { id: number }[];
    const docIds = (docResult || []).map((r) => r.id);

    // 문서 본문 -> 문서 순으로 삭제
    if (docIds.length > 0) {
      await sql`DELETE FROM document_contents WHERE document_id = ANY(${docIds})`;
      await sql`DELETE FROM documents WHERE id = ANY(${docIds})`;
    }

    // 카테고리 일괄 삭제
    await sql`DELETE FROM categories WHERE id = ANY(${catIds})`;

    // ✅ 캐시 무효화
    invalidate('category:list', 'category:tree', 'category:modes');
    if (docIds.length) invalidate(...docIds.map((d) => `doc:${d}`), 'doc:list');

    // 활동 로그
    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    await logActivity({
      action: 'category.delete',
      username,
      targetType: 'category',
      targetId: idNum,
      targetName: rootName,
      targetPath: parentLabel,
      meta: { deleted_category_ids: catIds, deleted_document_ids: docIds },
    });

    return NextResponse.json({ message: 'deleted' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[categories:id DELETE] unexpected error:', err);
    return NextResponse.json(
      { error: '카테고리 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const idNum = Number(params.id);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json(
        { error: 'invalid category id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 본문에서 order만 사용
    const body = await req.json().catch(() => null);
    const order = toIntOrDefault(body?.order, 0);

    await sql`UPDATE categories SET "order" = ${order} WHERE id = ${idNum}`;

    // ✅ 캐시 무효화
    invalidate('category:list', 'category:tree');

    // 로그에 표시할 라벨
    const catRows = (await sql`
      SELECT name, parent_id
      FROM categories
      WHERE id = ${idNum}
      LIMIT 1
    `) as unknown as { name: string | null; parent_id: number | null }[];
    const catName = catRows[0]?.name ?? null;
    const parentLabel = await resolveCategoryName(catRows[0]?.parent_id ?? null);

    const user = getAuthUser();
    const username = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    await logActivity({
      action: 'category.reorder',
      username,
      targetType: 'category',
      targetId: idNum,
      targetName: catName,
      targetPath: parentLabel,
      meta: { order },
    });

    return NextResponse.json({ message: 'order updated' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[categories:id POST] unexpected error:', err);
    return NextResponse.json(
      { error: '카테고리 순서 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
