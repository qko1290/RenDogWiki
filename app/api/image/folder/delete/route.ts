// File: app/api/image/delete/route.ts
/**
 * 이미지 삭제 API (DB + S3)
 * - DELETE body -> { ids: number[] }
 * - 흐름 -> ids 검증 -> DB에서 s3_key 조회 -> S3에서 객체 삭제 -> DB rows 삭제 -> 활동 로그
 * - 주의 -> 트랜잭션/롤백 없음. S3 또는 DB 한쪽 실패 가능성이 있음(기존 정책 유지)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { S3 } from 'aws-sdk';
import { logActivity } from '@wiki/lib/activity';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest) {
  try {
    // 1) 입력 파싱 -> ids는 정수 배열만 허용, 중복 제거
    type DeleteBody = { ids: number[] };

    const body = (await req.json().catch(() => null)) as Partial<DeleteBody> | null;
    const idsRaw: number[] = Array.isArray(body?.ids) ? (body!.ids as number[]) : [];

    if (idsRaw.length === 0) {
      return NextResponse.json(
        { error: 'ids 필요' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 양수 정수만, 중복 제거
    const ids: number[] = Array.from(
      new Set(
        idsRaw
          .map((v) => Number(v))
          .filter((n): n is number => Number.isFinite(n) && n > 0)
      )
    );

    if (ids.length === 0) {
      return NextResponse.json(
        { error: '유효한 id가 없습니다.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const username = req.headers.get('x-wiki-username') ?? null;

    // 2) 삭제 대상 s3_key 조회 (ANY 사용)
    const rows = (await sql`
      SELECT s3_key
      FROM images
      WHERE id = ANY(${ids})
    `) as Array<{ s3_key: string | null }>;

    // 키 정리 -> 빈 문자열/null 제거
    const keys = rows
      .map((r) => (r?.s3_key ? String(r.s3_key) : ''))
      .filter((k) => k.length > 0)
      .map((k) => ({ Key: k }));

    // 3) S3에서 실제 객체 삭제(대상이 있을 때만)
    if (keys.length > 0) {
      const bucket = process.env.S3_BUCKET_NAME;
      if (!bucket) {
        return NextResponse.json(
          { error: 'S3_BUCKET_NAME 누락' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // region/credentials는 환경/IAM에서 자동 추론 -> 명시 필요 시 AWS_REGION만 전달
      const s3 = new S3({
        region: process.env.AWS_REGION,
      });

      // deleteObjects는 최대 1000개까지 -> 분할 실행
      for (let i = 0; i < keys.length; i += 1000) {
        const slice = keys.slice(i, i + 1000);
        await s3
          .deleteObjects({
            Bucket: bucket,
            Delete: { Objects: slice },
          })
          .promise();
        // 참고: AWS SDK는 부분 실패도 200으로 오고 Errors 필드에 담길 수 있음 -> 기존 정책에 맞춰 추가 처리 없음
      }
    }

    // 4) DB에서 이미지 row 삭제 (ANY 사용)
    await sql`
      DELETE FROM images
      WHERE id = ANY(${ids})
    `;

    // 5) 활동 로그
    await logActivity({
      action: 'image.delete',
      username,
      targetType: 'image',
      targetId: null,
      targetName: null,
      targetPath: null,
      meta: { ids, requestedCount: idsRaw.length, s3KeysCount: keys.length },
    });

    // 6) 성공 응답
    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[image/delete] unexpected error:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
