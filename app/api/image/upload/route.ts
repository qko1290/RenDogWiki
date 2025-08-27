// =============================================
// File: app/api/image/upload/route.ts
// (용량 줄여서 업로드: sharp로 리사이즈+WebP 압축, 캐시 헤더, 안전 폴백)
// =============================================
/**
 * 이미지 업로드 (S3 + DB)
 * - POST (multipart/form-data)
 *   - fields -> files[] , folder_id
 *   - uploader -> 로그인 유저 닉네임 우선, 없으면 헤더, 최후엔 'admin'
 * - 흐름 -> formData 파싱 -> 입력 검증 -> (이미지면) 서버에서 리사이즈/압축 -> S3 업로드 -> DB 저장 -> 활동 로그
 * - 정책
 *   - GIF(애니메이션), SVG는 원본 업로드
 *   - 그 외 이미지: WebP(Q=80) + 긴 변 1600px로 리사이즈 (환경변수로 조정)
 *   - 변환 후 용량이 원본보다 커지면 원본 업로드(안전 폴백)
 *   - S3 Cache-Control: public, max-age=31536000, immutable
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { S3 } from 'aws-sdk';
import { getAuthUser } from '@/wiki/lib/auth';
import { logActivity, resolveFolderName } from '@wiki/lib/activity';

import sharp from 'sharp';
import crypto from 'crypto';

export const runtime = 'nodejs';

// ---- 설정 (env로 조정 가능) ----
const MAX_DIM = Number(process.env.WIKI_IMAGE_MAX_DIM || 1600);     // 긴 변 픽셀
const QUALITY = Number(process.env.WIKI_IMAGE_QUALITY || 80);       // 0~100
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// 간단한 파일명/확장자 유틸
function getSafeExt(filename: string) {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot + 1) : '';
  return ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toLowerCase();
}
function sha1Short(buf: Buffer) {
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
}
function buildKey(folderId: number, ext: string, hint?: string) {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const postfix = hint ? `_${hint}` : `_${rand}`;
  return `images/${folderId}/${now}${postfix}.${ext}`;
}

// 이미지 처리: WebP 리사이즈/압축 (필요 시 원본 폴백)
async function processImageIfNeeded(file: File): Promise<{
  buffer: Buffer;
  mime: string;
  ext: string;
  usedOriginal: boolean;
}> {
  const origBuf = Buffer.from(await file.arrayBuffer());
  const origMime = file.type || 'application/octet-stream';
  const origExt = getSafeExt(file.name) || 'bin';

  // 이미지가 아니면 그대로
  if (!origMime.startsWith('image/')) {
    return { buffer: origBuf, mime: origMime, ext: origExt, usedOriginal: true };
  }

  // SVG는 그대로
  if (origMime === 'image/svg+xml' || origExt === 'svg') {
    return { buffer: origBuf, mime: 'image/svg+xml', ext: 'svg', usedOriginal: true };
  }

  // sharp 메타데이터로 GIF 애니메이션 판별
  let meta: sharp.Metadata | null = null;
  try {
    meta = await sharp(origBuf, { animated: true }).metadata();
  } catch {
    // 디코드 실패 시 원본 업로드
    return { buffer: origBuf, mime: origMime, ext: origExt, usedOriginal: true };
  }

  // 애니메이션 GIF는 그대로(프레임 보존)
  if (meta.format === 'gif' && (meta.pages || 0) > 1) {
    return { buffer: origBuf, mime: 'image/gif', ext: 'gif', usedOriginal: true };
  }

  // 아주 작은 파일(예: <40KB)은 변환 이득이 적으니 그대로
  if (origBuf.byteLength < 40 * 1024) {
    return { buffer: origBuf, mime: origMime, ext: origExt, usedOriginal: true };
  }

  // 리사이즈(긴 변 기준) + WebP 손실 압축
  try {
    // fit: inside + withoutEnlargement 로 과확대 방지
    const transformer = sharp(origBuf, { animated: false })
      .rotate() // EXIF 회전 보정
      .resize({
        width: MAX_DIM,
        height: MAX_DIM,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: QUALITY,
        effort: 4, // 압축 속도/용량 타협
      });

    const webpBuf = await transformer.toBuffer();

    // 변환 결과가 더 크면 원본으로 폴백
    if (webpBuf.byteLength >= origBuf.byteLength) {
      return { buffer: origBuf, mime: origMime, ext: origExt, usedOriginal: true };
    }

    return { buffer: webpBuf, mime: 'image/webp', ext: 'webp', usedOriginal: false };
  } catch {
    // 변환 실패 시 원본 그대로
    return { buffer: origBuf, mime: origMime, ext: origExt, usedOriginal: true };
  }
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

    // 3) 파일별 업로드 반복 (순차 처리로 메모리 압박 방지)
    for (const file of files) {
      if (typeof file === 'string' || !(file instanceof File)) continue;

      // 3-0) 서버에서 용량 줄이기 (이미지면 가공)
      const processed = await processImageIfNeeded(file);
      const hash = sha1Short(processed.buffer);
      const key = buildKey(folderIdNum, processed.ext, hash);

      // 3-1) S3 업로드
      let s3result;
      try {
        s3result = await s3
          .upload({
            Bucket: bucket,
            Key: key,
            Body: processed.buffer,
            ContentType: processed.mime,
            CacheControl: CACHE_CONTROL,
            ContentDisposition: 'inline',
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
          VALUES (${file.name}, ${folderIdNum}, ${uploader}, ${key}, ${s3result.Location}, ${processed.mime || null})
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
      targetName,
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
