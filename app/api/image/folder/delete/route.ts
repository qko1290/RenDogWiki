import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';
import { S3 } from "aws-sdk";
import { getAuthUser } from '@/wiki/lib/auth';

export const runtime = "nodejs";

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

// image_folders 테이블 기준 재귀 쿼리
async function getAllFolderIds(rootId: number) {
  const { rows } = await db.query(`
    WITH RECURSIVE subfolders AS (
      SELECT id FROM image_folders WHERE id = $1
      UNION ALL
      SELECT f.id FROM image_folders f
      INNER JOIN subfolders sf ON f.parent_id = sf.id
    )
    SELECT id FROM subfolders
  `, [rootId]);
  return rows.map((r: any) => r.id);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const user = getAuthUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (!id) return NextResponse.json({ error: "필수값 누락" }, { status: 400 });

  // 1. 모든 하위 폴더 id 모으기
  const folderIds = await getAllFolderIds(id);

  // 2. S3 삭제할 이미지 key 모으기
  const { rows: imgs } = await db.query(
    `SELECT s3_key FROM images WHERE folder_id = ANY($1)`, [folderIds]
  );
  const s3keys = imgs.map(row => ({ Key: row.s3_key }));

  // 3. S3에서 이미지 실제 삭제
  if (s3keys.length > 0) {
    for (let i = 0; i < s3keys.length; i += 1000) {
      const part = s3keys.slice(i, i + 1000);
      await s3.deleteObjects({
        Bucket: process.env.S3_BUCKET_NAME!,
        Delete: { Objects: part }
      }).promise();
    }
  }

  // 4. DB에서 이미지 → 폴더 순서로 삭제
  await db.query(`DELETE FROM images WHERE folder_id = ANY($1)`, [folderIds]);
  await db.query(`DELETE FROM image_folders WHERE id = ANY($1)`, [folderIds]);

  return NextResponse.json({ ok: true, deleted: { folders: folderIds.length, images: s3keys.length } });
}
