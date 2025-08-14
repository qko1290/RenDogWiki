// =============================================
// File: app/api/image/upload/route.ts
// =============================================
/**
 * 이미지 업로드 (S3 + DB)
 * - POST (multipart/form-data)
 *   - fields -> files[] , folder_id
 *   - uploader -> 로그인 유저 닉네임 우선, 없으면 헤더, 최후엔 'admin'
 * - 흐름 -> formData 파싱 -> 입력 검증 -> S3 업로드 -> DB 저장 -> 활동 로그 -> 저장된 rows 반환
 * - 주의 -> 부분 실패 가능(S3/DB 사이 롤백 없음, 기존 정책 유지)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { S3 } from 'aws-sdk';
import { getAuthUser } from '@/wiki/lib/auth';
import { logActivity, resolveFolderName } from '@wiki/lib/activity';

export const runtime = 'nodejs';

// 간단한 파일명/확장자 유틸
function getSafeExt(filename: string) {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot + 1) : '';
  return ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
}
function randomKey(folderId: number, filename: string) {
  const ext = getSafeExt(filename) || 'bin';
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `images/${folderId}/${now}_${rand}.${ext}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1) formData 파싱
    const formData = await req.formData();
    const files = formData.getAll('files');
    const folderIdRaw = formData.get('folder_id');

    // 업로더 -> 인증 사용자 > 헤더 > 'admin'
    const authed = getAuthUser();
    const headerName = req.headers.get('x-wiki-username');
    const uploader = authed?.minecraft_name ?? headerName ?? 'admin';

    // 2) 입력 검증
    const folderIdNum = Number(folderIdRaw);
    if (!Number.isFinite(folderIdNum) || folderIdNum <= 0) {
      return NextResponse.json(
        { error: '폴더 ID 누락 또는 형식 오류' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (!files.length) {
      return NextResponse.json(
        { error: '파일 없음' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // S3 필수 환경 검사(버킷 이름은 반드시 필요)
    const bucket = process.env.S3_BUCKET_NAME;
    if (!bucket) {
      return NextResponse.json(
        { error: 'S3_BUCKET_NAME 누락' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    // 자격증명은 환경/IAM에서 자동 탐색. region만 명시(필요 시)
    const s3 = new S3({ region: process.env.AWS_REGION });

    const uploaded: any[] = [];

    // 3) 파일별 업로드 반복
    for (const file of files) {
      if (typeof file === 'string' || !(file instanceof File)) continue;

      // 파일 바이트 읽기
      const buffer = Buffer.from(await file.arrayBuffer());
      const key = randomKey(folderIdNum, file.name);

      // 3-1) S3 업로드
      let s3result;
      try {
        s3result = await s3
          .upload({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: file.type || 'application/octet-stream',
          })
          .promise();
      } catch (e: any) {
        return NextResponse.json(
          { error: 'S3 업로드 실패: ' + (e?.message || e) },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // 3-2) DB 저장
      try {
        const rows = (await sql`
          INSERT INTO images (name, folder_id, uploader, s3_key, url, mime_type)
          VALUES (${file.name}, ${folderIdNum}, ${uploader}, ${key}, ${s3result.Location}, ${file.type || null})
          RETURNING *
        `) as unknown as any[];
        uploaded.push(rows[0]);
      } catch (e: any) {
        // 주의: 여기서 실패해도 이미 S3에는 올라가 있음(롤백 없음)
        return NextResponse.json(
          { error: 'DB 저장 실패: ' + (e?.message || e) },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // 4) 활동 로그(배치 요약 1건)
    const folderLabel = await resolveFolderName(folderIdNum);
    const names = uploaded.map((r) => r.name);
    const targetName = names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}개`;

    await logActivity({
      action: 'image.upload',
      username: uploader,
      targetType: 'image',
      targetId: null,
      targetName, // 첫 파일명(여럿이면 요약)
      targetPath: folderLabel ?? String(folderIdNum),
      meta: {
        folder_id: folderIdNum,
        folder_name: folderLabel ?? null,
        count: uploaded.length,
        ids: uploaded.map((r) => r.id),
        names,
      },
    });

    // 5) 성공 응답
    return NextResponse.json(
      { images: uploaded },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    console.error('[image/upload POST] unexpected error:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
