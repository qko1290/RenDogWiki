// =============================================
// File: app/api/image/upload/route.ts
// (이미지: sharp 리사이즈/WebP, 영상: ffmpeg 4MB 타깃 인코딩, S3 캐시, 안전 폴백)
// =============================================
/**
 * 업로드 (S3 + DB) - 이미지/영상 공용
 * - POST (multipart/form-data)
 *   - fields -> files[] , folder_id
 *   - uploader -> 로그인 유저 닉네임 우선, 없으면 헤더, 최후엔 'admin'
 * - 흐름 -> formData 파싱 -> 입력 검증
 *        -> (이미지면 sharp, 영상이면 ffmpeg로 압축) -> S3 업로드 -> DB 저장 -> 활동 로그
 * - 정책
 *   [이미지]
 *     - GIF(애니메이션), SVG는 원본 업로드
 *     - 그 외 이미지: WebP(Q=80) + 긴 변 1600px 리사이즈 (env 조정)
 *     - 변환 후 용량이 원본보다 크면 원본 업로드(안전 폴백)
 *   [영상]
 *     - 목표 용량(TARGET_MB=4MB) 맞추도록 평균 비트레이트 산출하여 MP4(H.264/AAC)로 인코딩
 *     - 가로 최대폭 MAX_WIDTH(기본 720px)로 스케일
 *     - 원본이 타깃보다 작고, 인코딩 결과보다도 작으면 원본 유지(안전 폴백)
 *   - S3 Cache-Control: public, max-age=31536000, immutable
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { S3 } from 'aws-sdk';
import { getAuthUser } from '@/wiki/lib/auth';
import { logActivity, resolveFolderName } from '@wiki/lib/activity';

import sharp from 'sharp';
import crypto from 'crypto';

// ---- 동영상 인코딩 의존성 ----
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
ffmpeg.setFfprobePath((ffprobeStatic as any).path);

export const runtime = 'nodejs';

// ---- 설정 (env로 조정 가능) ----
// 이미지
const MAX_DIM = Number(process.env.WIKI_IMAGE_MAX_DIM || 1600);     // 긴 변 픽셀
const QUALITY = Number(process.env.WIKI_IMAGE_QUALITY || 80);       // 0~100
// 영상
const TARGET_MB = Number(process.env.WIKI_VIDEO_TARGET_MB || 4);    // 목표 용량(MB)
const MAX_WIDTH = Number(process.env.WIKI_VIDEO_MAX_WIDTH || 720);  // 가로 최대폭(px)
const AUDIO_K   = Number(process.env.WIKI_VIDEO_AUDIO_K || 64);     // 오디오 비트레이트(kbps)

// S3 캐시
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

// ---------------------- 이미지 처리 ----------------------
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

// ---------------------- 영상 처리 ----------------------
async function getDurationSec(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(0);
      resolve(Number(data?.format?.duration || 0) || 0);
    });
  });
}

async function transcodeToTargetMP4(
  inputPath: string,
  targetMB: number,
  maxWidth: number,
  audioKbps: number
) {
  const targetBytes = targetMB * 1024 * 1024;
  const dur = await getDurationSec(inputPath);

  // 목표 용량으로부터 평균 비트레이트 계산 (kbps)
  const totalKbps = dur > 0 ? Math.max(200, Math.floor((targetBytes * 8) / dur / 1000)) : 600;
  const videoK = Math.max(100, totalKbps - audioKbps);

  const outPath = path.join(
    os.tmpdir(),
    `out_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`
  );

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset veryfast',
        `-b:v ${videoK}k`,
        `-maxrate ${videoK}k`,
        `-bufsize ${videoK * 2}k`,
        `-vf scale='min(${maxWidth},iw)':'-2'`,
        '-c:a aac',
        `-b:a ${audioKbps}k`,
        '-movflags +faststart',
      ])
      .on('end', () => resolve())
      .on('error', reject)
      .save(outPath);
  });

  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath).catch(() => {});
  return buf;
}

async function processVideoIfNeeded(file: File): Promise<{
  buffer: Buffer;
  mime: string;
  ext: string;
  usedOriginal: boolean;
}> {
  const origBuf = Buffer.from(await file.arrayBuffer());
  const origExt = getSafeExt(file.name) || 'bin';
  const origMime = file.type || 'application/octet-stream';

  if (!origMime.startsWith('video/')) {
    return { buffer: origBuf, mime: origMime, ext: origExt, usedOriginal: true };
  }

  // 임시 입력 파일 생성
  const inPath = path.join(
    os.tmpdir(),
    `in_${Date.now()}_${Math.random().toString(36).slice(2)}.${origExt}`
  );
  await fs.writeFile(inPath, origBuf);

  try {
    const outBuf = await transcodeToTargetMP4(inPath, TARGET_MB, MAX_WIDTH, AUDIO_K);
    const targetBytes = TARGET_MB * 1024 * 1024;

    // 원본이 타깃 이하 & 인코딩 결과보다 작다면 원본 유지
    const pickOriginal =
      origBuf.byteLength <= targetBytes && origBuf.byteLength <= outBuf.byteLength;

    if (pickOriginal) {
      return { buffer: origBuf, mime: origMime, ext: origExt, usedOriginal: true };
    }
    return { buffer: outBuf, mime: 'video/mp4', ext: 'mp4', usedOriginal: false };
  } catch {
    // 인코딩 실패 시 원본 유지
    return { buffer: origBuf, mime: origMime, ext: origExt, usedOriginal: true };
  } finally {
    await fs.unlink(inPath).catch(() => {});
  }
}

// ========================================================

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

      // MIME 기반으로 분기 (이미지/영상/기타)
      const t = (file.type || '').toLowerCase();

      let processed:
        | { buffer: Buffer; mime: string; ext: string; usedOriginal: boolean }
        | null = null;

      if (t.startsWith('image/')) {
        processed = await processImageIfNeeded(file);
      } else if (t.startsWith('video/')) {
        processed = await processVideoIfNeeded(file);
      } else {
        const buffer = Buffer.from(await file.arrayBuffer());
        processed = {
          buffer,
          mime: file.type || 'application/octet-stream',
          ext: getSafeExt(file.name) || 'bin',
          usedOriginal: true,
        };
      }

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

      // 3-2) DB 저장 (이미지 테이블 그대로 사용)
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
