import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';

/**
 * 폴더 생성
 * POST { name, parent_id }
 */
export async function POST(req: NextRequest) {
  const { name, parent_id } = await req.json();
  const user = getAuthUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (!name || parent_id === undefined) return NextResponse.json({ error: "필수값 누락" }, { status: 400 });

  // 중복 체크
  const existsResult = await db.query(
    'SELECT id FROM image_folders WHERE parent_id = $1 AND name = $2 LIMIT 1',
    [parent_id, name]
  );
  if (existsResult.rows.length > 0) return NextResponse.json({ error: "중복 폴더명" }, { status: 409 });

  // 생성
  const insertResult = await db.query(
    'INSERT INTO image_folders (name, parent_id, uploader) VALUES ($1, $2, $3) RETURNING id',
    [name, parent_id, user.minecraft_name]
  );
  const folderId = insertResult.rows[0].id;
  return NextResponse.json({ ok: true, folder: { id: folderId, name, parent_id, uploader: user.minecraft_name } });
}
