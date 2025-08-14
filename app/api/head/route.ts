// =============================================
// File: app/api/head/route.ts
// =============================================
/**
 * Head Finder 목록 조회/신규 등록
 * - GET  -> /api/head?village_id=xxx  마을별 목록 반환
 * - POST -> /api/head                  새 레코드 등록
 * - pictures는 문자열/JSON/배열이 올 수 있어도 배열로 정규화해서 다룸
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { logActivity, resolveVillageName } from '@wiki/lib/activity';
import { getAuthUser } from '@/wiki/lib/auth';

export const runtime = 'nodejs';

type HeadRow = {
  id: number;
  village_id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures: unknown; // DB에 json/text/array일 수 있음
};

// 문자열/JSON/배열 입력을 안전한 배열로 정규화
function parsePictures(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (v == null) return [];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// [GET] ?village_id=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const villageIdParam = searchParams.get('village_id');
    const village_id = villageIdParam != null ? Number(villageIdParam) : NaN;

    // village_id 없거나 숫자 아님 -> 빈 배열 반환(기존 동작 유지)
    if (!villageIdParam || !Number.isFinite(village_id)) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const rows = (await sql`
      SELECT id, village_id, "order", location_x, location_y, location_z, pictures
      FROM head_finder
      WHERE village_id = ${village_id}
      ORDER BY "order"
    `) as unknown as HeadRow[];

    const normalized = rows.map((r) => ({
      ...r,
      pictures: parsePictures(r.pictures),
    }));

    return NextResponse.json(normalized, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[head GET] unexpected error:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// [POST] 추가
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const authed = getAuthUser();
    const username =
      authed?.minecraft_name ?? req.headers.get('x-wiki-username') ?? null;

    // 필수값 존재 여부만 확인(기존 규칙 유지) -> 타입은 아래에서 보정
    const required = [
      'village_id',
      'order',
      'location_x',
      'location_y',
      'location_z',
      'pictures',
    ] as const;

    for (const key of required) {
      if (body[key] === undefined || body[key] === null) {
        return NextResponse.json(
          { error: `${key} 필수` },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // 숫자 필드 정규화 -> Number 변환, NaN이면 DB에서 오류가 나므로 기본 동작을 유지
    const village_id = Number(body.village_id);
    const order = Number(body.order);
    const location_x = Number(body.location_x);
    const location_y = Number(body.location_y);
    const location_z = Number(body.location_z);

    // pictures는 배열로 정규화(문자열/객체가 와도 빈 배열로 처리 -> 기존과 동일한 관용)
    const pictures = Array.isArray(body.pictures)
      ? (body.pictures as string[])
      : [];

    const inserted = (await sql`
      INSERT INTO head_finder
        (village_id, "order", location_x, location_y, location_z, pictures)
      VALUES (
        ${village_id},
        ${order},
        ${location_x},
        ${location_y},
        ${location_z},
        ${JSON.stringify(pictures)}
      )
      RETURNING id, village_id, "order", location_x, location_y, location_z, pictures
    `) as unknown as HeadRow[];

    const row = inserted[0];
    const normalized = {
      ...row,
      pictures: parsePictures(row.pictures),
    };

    // 활동 로그 -> 경로에는 village 이름 사용
    const villageLabel = await resolveVillageName(normalized.village_id);

    await logActivity({
      action: 'head.create',
      username,
      targetType: 'head',
      targetId: normalized.id,
      targetName: `${normalized.order}번 머리`,
      targetPath: villageLabel,
      meta: {
        location: {
          x: normalized.location_x,
          y: normalized.location_y,
          z: normalized.location_z,
        },
        picturesCount: Array.isArray(normalized.pictures)
          ? normalized.pictures.length
          : 0,
      },
    });

    return NextResponse.json(normalized, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[head POST] unexpected error:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
