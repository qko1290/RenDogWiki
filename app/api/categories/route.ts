/**
 * 카테고리 전체 조회/생성 API
 * - GET
 *   - 기본: 모든 카테고리 목록을 parent_id, "order" 순으로 반환
 *   - ?modes=pvp,creative : 지정 모드 태그가 있는 상위 카테고리 + 그 하위 전체 트리만 반환
 *     (상위가 태그를 가지면 하위는 태그 유무와 무관하게 포함)
 * - POST
 *   - 신규 카테고리 생성(name 필수, parent/document/icon/mode_tags 선택)
 * - 메모: "order"는 Postgres 예약어라 항상 쌍따옴표 필요
 */

import { sql } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logActivity, resolveCategoryName } from '@wiki/lib/activity';
import { getAuthUser } from '@/wiki/lib/auth';
import { cached, cacheKey, invalidate } from '@wiki/lib/cache';

export const runtime = 'nodejs';

// 숫자/문자/널 입력을 정수 또는 null로 정규화
function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// 쉼표 구분 문자 배열 파싱(공백/중복/빈값 제거, 소문자 통일)
function parseModes(param: string | null): string[] {
  if (!param) return [];
  const arr = param
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(arr));
}

export async function GET(req: NextRequest) {
  try {
    const modes = parseModes(req.nextUrl.searchParams.get('modes'));

    // 모드 미지정: 전체 조회(캐시)
    if (modes.length === 0) {
      const rows = await cached(
        'category:all',
        { ttlSec: 600, tags: ['category:list', 'category:tree'] },
        async () => sql`SELECT * FROM categories ORDER BY parent_id, "order"`
      );
      return NextResponse.json(rows, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      });
    }

    // 모드 지정: roots만 고른 뒤 재귀 확장(캐시)
    const key = cacheKey('category:tree', 'modes', ...modes);
    const rows = await cached(
      key,
      { ttlSec: 600, tags: ['category:tree', 'category:list'] },
      async () => {
        // postgres 드라이버 호환을 위해 EXISTS + ANY 사용
        return sql`
          WITH RECURSIVE roots AS (
            SELECT id
            FROM categories
            WHERE EXISTS (
              SELECT 1
              FROM unnest(COALESCE(mode_tags, '{}'::text[])) t
              WHERE t = ANY(${modes})
            )
          ),
          tree AS (
            SELECT c.*
            FROM categories c
            JOIN roots r ON r.id = c.id
            UNION ALL
            SELECT c2.*
            FROM categories c2
            JOIN tree t ON c2.parent_id = t.id
          )
          SELECT * FROM tree
          ORDER BY parent_id, "order"
        `;
      }
    );

    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
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

    // TEXT[] 모드 태그(선택)
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

    // 2) 같은 parent 내 다음 order 계산 -> MAX("order") + 1
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

    // 3) uploader
    const me = getAuthUser();
    const uploader = me?.minecraft_name ?? req.headers.get('x-wiki-username') ?? 'admin';

    // 4) INSERT -> 새 id 반환
    const insertRows = (await sql`
      INSERT INTO categories (name, parent_id, "order", document_id, icon, mode_tags, uploader)
      VALUES (${name}, ${parent_id}, ${nextOrder}, ${document_id}, ${icon}, ${mode_tags}, ${uploader})
      RETURNING id
    `) as unknown as Array<{ id: number | string }>;
    const newId = Number(insertRows?.[0]?.id);

    // 5) 활동 로그
    const parentLabel = await resolveCategoryName(parent_id);

    await logActivity({
      action: 'category.create',
      username: uploader,
      targetType: 'category',
      targetId: newId,
      targetName: name,
      targetPath: parentLabel,
      meta: {
        parent_id,
        order: nextOrder,
        document_id: document_id ?? null,
        icon: icon ?? null,
        mode_tags: mode_tags,
      },
    });

    // ✅ 캐시 무효화
    invalidate('category:list', 'category:tree', 'category:modes');

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
