// =============================================
// File: app/api/image/folder/list/route.ts
// =============================================
/**
 * 이미지 폴더 목록 조회 API (상위 폴더별 or 전체)
 * - GET parent_id 없으면 전체, 있으면 하위만
 * - 캐시 무효화: force-dynamic + no-store
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parent_id = searchParams.get('parent_id');

  let rows;
  if (!parent_id) {
    rows = await sql`SELECT * FROM image_folders ORDER BY id ASC`;
  } else {
    rows = await sql`
      SELECT * FROM image_folders
      WHERE parent_id = ${parseInt(parent_id)}
      ORDER BY id ASC
    `;
  }

  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
