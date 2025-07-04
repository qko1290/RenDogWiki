import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';
import { S3 } from "aws-sdk";

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();
  if (!ids || !Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'ids 필요' }, { status: 400 });

  const { rows } = await db.query(`SELECT s3_key FROM images WHERE id = ANY($1)`, [ids]);
  const keys = rows.map((r: any) => ({ Key: r.s3_key }));

  if (keys.length > 0) {
    const s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      region: process.env.AWS_REGION!,
    });
    for (let i = 0; i < keys.length; i += 1000) {
      await s3.deleteObjects({
        Bucket: process.env.S3_BUCKET_NAME!,
        Delete: { Objects: keys.slice(i, i + 1000) }
      }).promise();
    }
  }

  await db.query('DELETE FROM images WHERE id = ANY($1)', [ids]);
  return NextResponse.json({ success: true });
}
