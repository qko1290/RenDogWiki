import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';

/**
 * 폴더 이름 수정
 * PATCH { id, name }
 */
export async function PATCH(req: NextRequest) {
  const { id, name } = await req.json();
  const user = getAuthUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (!id || !name) return NextResponse.json({ error: "필수값 누락" }, { status: 400 });

  // 기존 폴더 확인
  const folderResult = await db.query('SELECT * FROM image_folders WHERE id = $1', [id]);
  const folder = folderResult.rows[0];
  if (!folder) return NextResponse.json({ error: "폴더 없음" }, { status: 404 });

  // 중복 체크
  const existsResult = await db.query(
    'SELECT id FROM image_folders WHERE parent_id = $1 AND name = $2 AND id != $3 LIMIT 1',
    [folder.parent_id, name, id]
  );
  if (existsResult.rows.length > 0) return NextResponse.json({ error: "중복 폴더명" }, { status: 409 });

  await db.query('UPDATE image_folders SET name = $1 WHERE id = $2', [name, id]);
  return NextResponse.json({ ok: true });
}
