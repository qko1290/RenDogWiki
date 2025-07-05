// =============================================
// File: app/api/image/delete/route.ts
// =============================================
/**
 * 이미지 삭제 API (DB + S3 삭제)
 * - [DELETE] images 테이블에서 id로 여러 개 삭제 + S3에서 실제 이미지 객체도 함께 삭제
 * - ids 배열(삭제할 이미지 id들) 필수
 * - AWS S3 연동: s3_key 기준으로 실제 이미지 삭제
 * - 주요 사용처: 이미지 탐색기, 이미지 관리 페이지 등에서 일괄 삭제
 * - 주의: S3, DB 모두 동기 처리(실패 시 롤백 미구현. S3/DB 한쪽만 실패 할 가능성 있음)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db'; // DB
import { S3 } from "aws-sdk"; // AWS S3 SDK

/**
 * [이미지 일괄 삭제] DELETE
 * - ids: 삭제할 이미지 id 배열
 * - 1. images 테이블에서 s3_key 조회
 * - 2. S3에서 deleteObjects로 실제 이미지 파일 삭제
 * - 3. DB에서 images row 삭제
 * - 실패시 400(입력 누락), 그 외 500 등 응답
 */
export async function DELETE(req: NextRequest) {
  // 1. 입력값 검증(ids: 배열, 필수, 1개 이상)
  const { ids } = await req.json();
  if (!ids || !Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'ids 필요' }, { status: 400 });

  // 2. 삭제 대상 s3_key 조회
  // 일치하는 s3_key 모두 반환
  const { rows } = await db.query(
    `SELECT s3_key FROM images WHERE id = ANY($1)`,
    [ids]
  );
  // S3 객체 Key 형식 맞춰 변환
  const keys = rows.map((r: any) => ({ Key: r.s3_key }));

  // 3. S3에서 실제 객체 삭제
  // keys.length == 0이면 S3는 스킵(DB만 삭제)
  if (keys.length > 0) {
    // S3 인스턴스 생성(환경변수 기반)
    const s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      region: process.env.AWS_REGION!,
    });
    // deleteObjects는 최대 1000개까지, 여러 번 나눠 처리
    for (let i = 0; i < keys.length; i += 1000) {
      await s3.deleteObjects({
        Bucket: process.env.S3_BUCKET_NAME!,
        Delete: { Objects: keys.slice(i, i + 1000) }
      }).promise();
    }
  }

  // 4. DB에서 이미지 row 실제 삭제
  await db.query('DELETE FROM images WHERE id = ANY($1)', [ids]);

  // 5. 삭제 성공 응답
  // S3, DB 모두 성공 시 success: true 반환(실패시 예외 발생)
  return NextResponse.json({ success: true });
}
