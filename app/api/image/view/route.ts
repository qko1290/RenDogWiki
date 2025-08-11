// =============================================
// File: app/api/image/view/route.ts
// =============================================
/**
 * 이미지 폴더별 목록 조회 API
 * - GET folder_id 필수, 최신순
 * - 캐시 무효화: force-dynamic + no-store
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folder_id = searchParams.get('folder_id');
  if (!folder_id) {
    return NextResponse.json({ error: '폴더 ID 누락' }, { status: 400 });
  }

  const result = await sql`
    SELECT * FROM images
    WHERE folder_id = ${parseInt(folder_id)}
    ORDER BY id DESC
  `;

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
