// =============================================
// File: app/api/image/view/route.ts
// =============================================
/**
 * 이미지(미디어) 폴더별 목록 조회
 * - GET 쿼리 -> folder_id(필수)
 * - 최신순(id DESC)으로 반환
 * - 캐시 방지 -> no-store
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderParam = searchParams.get('folder_id');

    // folder_id 없으면 바로 400
    if (folderParam == null || folderParam === '') {
      return NextResponse.json(
        { error: '폴더 ID 누락' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 숫자 변환 검증
    const folderId = Number(folderParam);
    if (!Number.isFinite(folderId) || folderId <= 0) {
      return NextResponse.json(
        { error: '잘못된 폴더 ID' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 폴더 내 미디어 최신순 조회
    const rows = await sql/*sql*/`
      SELECT id, name, url, folder_id, uploader, mime_type
      FROM images
      WHERE folder_id = ${folderId}
      ORDER BY id DESC
    `;

    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[image/view GET] unexpected error:', err);
    return NextResponse.json(
      { error: 'server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
