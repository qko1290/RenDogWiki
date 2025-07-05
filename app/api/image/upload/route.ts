// =============================================
// File: app/api/image/upload/route.ts
// =============================================
/**
 * 이미지 파일 업로드 API (S3 + DB)
 * - [POST] multipart/form-data (formData 사용)
 * - 여러 파일(files[]), folder_id, uploader(임시: admin) 입력
 * - S3 업로드 + DB 저장(성공 시 저장된 이미지 row 반환)
 * - 반드시 runtime=nodejs (aws-sdk: edge 환경 미지원)
 * - 주의: S3 업로드 실패/DB 저장 실패 각각 별도 에러 처리
 * - uploader 값이 아직 연결이 안되어 있어서 로그인 인증값과 연결 해야해요
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/wiki/lib/db"; // DB
import { S3 } from "aws-sdk"; // AWS S3 SDK

export const runtime = "nodejs"; // 반드시 nodejs 환경

// S3 인스턴스(환경변수)
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

/**
 * [이미지 업로드] POST
 * - 입력: multipart/form-data (files[], folder_id 필수)
 * - 1. formData 파싱, 파일/폴더ID 확인
 * - 2. 각 파일 S3 업로드, DB 저장
 * - 3. 성공 시 저장된 이미지 row[] 반환
 * - 에러: 폴더ID 누락(400), 파일 없음(400), S3 업로드 실패(500), DB 저장 실패(500)
 */
export async function POST(req: NextRequest) {
  // 1. formData 파싱
  const formData = await req.formData();
  const files = formData.getAll("files");
  const folderId = formData.get("folder_id");
  const uploader = "admin"; // 추후 인증 계정 연결 필요

  // 2. 필수값 체크
  if (!folderId) {
    return NextResponse.json({ error: "폴더 ID 누락" }, { status: 400 });
  }
  if (!files.length) {
    return NextResponse.json({ error: "파일 없음" }, { status: 400 });
  }

  const uploaded = []; // 저장된 이미지 row 리스트

  // 3. 파일별 업로드 반복
  for (const file of files) {
    // 파일 타입 검증(문자열 필터/빈값 무시)
    if (
      typeof file === "string" ||
      !(file instanceof File)
    ) continue;

    // 3-1. 파일 버퍼 추출
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split(".").pop() ?? "";
    const key = `images/${folderId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // 3-2. S3 업로드
    let s3result;
    try {
      s3result = await s3.upload({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      }).promise();
    } catch (e: any) {
      // S3 업로드 실패시 에러 반환
      return NextResponse.json({ error: "S3 업로드 실패: " + e.message }, { status: 500 });
    }

    // 3-3. DB 저장
    let dbResult;
    try {
      dbResult = await db.query(
        `INSERT INTO images (name, folder_id, uploader, s3_key, url, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [file.name, folderId, uploader, key, s3result.Location, file.type]
      );
    } catch (e: any) {
      // DB 저장 실패시 에러 반환
      return NextResponse.json({ error: "DB 저장 실패: " + e.message }, { status: 500 });
    }

    // 3-4. 업로드된 이미지 row 저장
    uploaded.push(dbResult.rows[0]);
  }

  // 4. 전체 결과 반환
  return NextResponse.json({ images: uploaded });
}
