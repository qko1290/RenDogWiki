// File: app/api/image/delete/route.ts
/**
 * 이미지 삭제 API (DB + S3)
 * - DELETE body -> { ids: number[] | string[] | Array<{id:number}> }
 * - 흐름 -> ids 정규화 -> DB에서 s3_key 조회 -> S3 삭제 -> DB 삭제 -> 로그
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { S3 } from 'aws-sdk';
import { logActivity } from '@wiki/lib/activity';

export const runtime = 'nodejs';

// 입력 ids를 완전히 안전하게 number[]로 변환하는 유틸
function normalizeIds(input: any): number[] {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .map((v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return Number(v);
      if (v && typeof v === 'object' && 'id' in v) return Number((v as any).id);
      return NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0);

  return Array.from(new Set(normalized));
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const ids = normalizeIds(body?.ids);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: '유효한 ids가 없습니다.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const username = req.headers.get('x-wiki-username') ?? null;

    // 삭제 대상 S3 key 조회
    const rows = await sql<{ s3_key: string | null }[]>`
      SELECT s3_key
      FROM images
      WHERE id = ANY(${sql.array(ids, 'int4')})
    `;

    const keys = rows
      .map((r) => (r?.s3_key ? String(r.s3_key) : ''))
      .filter((k) => k.length > 0)
      .map((k) => ({ Key: k }));

    // S3 삭제
    if (keys.length > 0) {
      const bucket = process.env.S3_BUCKET_NAME;
      if (!bucket) {
        return NextResponse.json({ error: 'S3_BUCKET_NAME 누락' }, { status: 500 });
      }

      const s3 = new S3({ region: process.env.AWS_REGION });

      for (let i = 0; i < keys.length; i += 1000) {
        await s3
          .deleteObjects({
            Bucket: bucket,
            Delete: { Objects: keys.slice(i, i + 1000) },
          })
          .promise();
      }
    }

    // DB 삭제
    await sql`
      DELETE FROM images
      WHERE id = ANY(${sql.array(ids, 'int4')})
    `;

    // 활동 로그
    await logActivity({
      action: 'image.delete',
      username,
      targetType: 'image',
      targetId: null,
      targetName: null,
      targetPath: null,
      meta: { ids, count: ids.length, s3KeysCount: keys.length },
    });

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[image/delete] unexpected error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
