import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';

// GET /api/image/view?folder_id=5
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folder_id = searchParams.get("folder_id");
  if (!folder_id) {
    return NextResponse.json({ error: "폴더 ID 누락" }, { status: 400 });
  }

  // 폴더 내 모든 이미지 조회 (최신순)
  const result = await db.query(
    'SELECT * FROM images WHERE folder_id = $1 ORDER BY id DESC',
    [parseInt(folder_id)]
  );
  return NextResponse.json(result.rows);
}
