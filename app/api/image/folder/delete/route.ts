// File: app/api/image/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { S3 } from 'aws-sdk';
import { logActivity } from '@wiki/lib/activity';

export const runtime = 'nodejs';

function normalizeIds(raw: any): number[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((v) => {
          if (typeof v === "number") return v;
          if (typeof v === "string") return Number(v);
          if (v && typeof v === "object" && "id" in v) return Number(v.id);
          return NaN;
        })
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  );
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const raw = body?.ids;
    const ids = normalizeIds(raw);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "유효한 ids가 없습니다." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const username = req.headers.get('x-wiki-username') ?? null;

    const rows = await sql<{ s3_key: string | null }[]>`
      SELECT s3_key FROM images
      WHERE id = ANY(${sql.array(ids, 'int4')})
    `;

    const keys = rows
      .map((r) => (r?.s3_key ? String(r.s3_key) : ""))
      .filter((k) => k.length > 0)
      .map((k) => ({ Key: k }));

    // S3 객체 삭제
    if (keys.length > 0) {
      const bucket = process.env.S3_BUCKET_NAME;
      if (!bucket) {
        return NextResponse.json(
          { error: "S3_BUCKET_NAME 누락" },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      const s3 = new S3({ region: process.env.AWS_REGION });

      for (let i = 0; i < keys.length; i += 1000) {
        const slice = keys.slice(i, i + 1000);
        await s3.deleteObjects({ Bucket: bucket, Delete: { Objects: slice } }).promise();
      }
    }

    // DB 삭제
    await sql`
      DELETE FROM images
      WHERE id = ANY(${sql.array(ids, 'int4')})
    `;

    await logActivity({
      action: "image.delete",
      username,
      targetType: "image",
      targetId: null,
      targetName: null,
      targetPath: null,
      meta: {
        ids,
        requestedCount: Array.isArray(raw) ? raw.length : 0,
        s3KeysCount: keys.length,
      },
    });

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[image/delete] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
