// =============================================
// File: app/api/image/folder/delete/route.ts
// =============================================
/**
 * 이미지 폴더 일괄 삭제 API
 * - [DELETE] image_folders의 지정 id(루트폴더) 및 모든 하위 폴더/이미지 재귀 삭제
 * - S3에서 모든 이미지 동기 삭제
 * - 삭제 권한: 로그인 유저만 허용(추후 관리자 권한을 따로 만들 예정입니다)
 * - 주의: S3/DB 양쪽 모두 완전 삭제, 하위폴더/이미지도 모두 포함
 * - 트리구조 폴더라 재귀 쿼리 사용(WITH RECURSIVE)
 * - 사용처: 이미지 관리 페이지 폴더/하위 전체 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';            // DB
import { S3 } from "aws-sdk";                  // AWS S3 SDK
import { getAuthUser } from '@/wiki/lib/auth'; // 로그인 유저 인증

// Next.js Edge 환경 방지용
export const runtime = "nodejs";

// S3 인스턴스(환경변수)
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

/**
 * 재귀적으로 모든 하위 폴더 id를 추출하는 함수
 * - 입력: 루트 폴더 id
 * - 반환: 자기 자신을 포함한 하위 모든 폴더 id 배열
 */
async function getAllFolderIds(rootId: number) {
  const rows = await sql`
    WITH RECURSIVE subfolders AS (
      SELECT id FROM image_folders WHERE id = ${rootId}
      UNION ALL
      SELECT f.id FROM image_folders f
      INNER JOIN subfolders sf ON f.parent_id = sf.id
    )
    SELECT id FROM subfolders
  `;
  return rows.map((r: any) => r.id);
}

/**
 * 폴더 및 모든 하위 폴더, 포함된 이미지까지 S3와 DB에서 일괄 삭제하는 API
 * - 입력: id(삭제할 폴더 id)
 * - 1. 로그인 필요(getAuthUser, 미인증시 401)
 * - 2. id 누락시 400 에러
 * - 3. 모든 하위폴더 id 추출(getAllFolderIds)
 * - 4. 해당 폴더들에 포함된 이미지 S3 키 모두 추출
 * - 5. S3에서 실제 이미지 삭제(1000개 단위로 분할 처리)
 * - 6. DB에서 images → image_folders 순서로 삭제(참조 무결성)
 * - 7. 성공 시 삭제된 폴더/이미지 개수 반환
 */
export async function DELETE(req: NextRequest) {
  // 1. 입력 파싱 및 인증 체크
  const { id } = await req.json();
  const user = getAuthUser();
  if (!user)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (!id)
    return NextResponse.json({ error: "필수값 누락" }, { status: 400 });

  // 2. 모든 하위 폴더 id 재귀 수집
  const folderIds = await getAllFolderIds(id);

  // 3. 해당 폴더 내 이미지 S3 key 모두 수집
  // images 테이블에서 folder_id 검색
  const imgs = await sql`
    SELECT s3_key FROM images WHERE folder_id = ANY(${folderIds})
  `;
  const s3keys = imgs.map((row: any) => ({ Key: row.s3_key }));

  // 4. S3에서 이미지 삭제 (1000개 단위 분할 처리)
  if (s3keys.length > 0) {
    for (let i = 0; i < s3keys.length; i += 1000) {
      const part = s3keys.slice(i, i + 1000);
      await s3.deleteObjects({
        Bucket: process.env.S3_BUCKET_NAME!,
        Delete: { Objects: part }
      }).promise();
    }
  }

  // 5. DB에서 images → image_folders 순서로 삭제
  // (참조 무결성: images 먼저, 그 후 폴더)
  await sql`DELETE FROM images WHERE folder_id = ANY(${folderIds})`;
  await sql`DELETE FROM image_folders WHERE id = ANY(${folderIds})`;

  // 6. 성공 응답(삭제 개수 반환)
  return NextResponse.json({
    ok: true,
    deleted: {
      folders: folderIds.length,
      images: s3keys.length
    }
  });
}
