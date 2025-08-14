// =============================================
// File: app/api/image/folder/list/route.ts
// =============================================
/**
 * 이미지 폴더 목록 조회
 * - GET
 *   - parent_id 미지정/빈값 -> 전체 목록
 *   - parent_id 지정       -> 해당 폴더의 직계 하위만
 * - 캐시 방지 -> no-store
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parentParam = searchParams.get('parent_id');

    // parent_id가 없거나 빈 문자열이면 전체 반환(기존 동작 유지)
    if (parentParam == null || parentParam === '') {
      const rows = await sql`SELECT * FROM image_folders ORDER BY id ASC`;
      return NextResponse.json(rows, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // parent_id가 전달되었다면 숫자여야 함
    const parentId = Number(parentParam);
    if (!Number.isFinite(parentId)) {
      return NextResponse.json(
        { error: 'invalid parent_id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const rows = await sql`
      SELECT * FROM image_folders
      WHERE parent_id = ${parentId}
      ORDER BY id ASC
    `;

    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[image/folder/list GET] unexpected error:', err);
    return NextResponse.json(
      { error: 'server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
