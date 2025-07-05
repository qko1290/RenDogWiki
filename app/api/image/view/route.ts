// =============================================
// File: app/api/image/view/route.ts
// =============================================
/**
 * 이미지 폴더별 목록 조회 API
 * - [GET] 쿼리 파라미터 folder_id로 지정 폴더 내 이미지 전부 반환 (최신순)
 * - 반환: images 테이블 row[]
 * - 에러: folder_id 누락시 400 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db'; // DB

/**
 * [폴더 내 이미지 리스트 조회] GET
 * - 입력: folder_id
 * - 1. folder_id 누락시 400 반환
 * - 2. images 테이블에서 folder_id 가 일치하는 row 전부 조회(최신순)
 * - 3. row[] 반환
 */
export async function GET(req: NextRequest) {
  // 1. 쿼리 파라미터 파싱 및 필수값 체크
  const { searchParams } = new URL(req.url);
  const folder_id = searchParams.get("folder_id");
  if (!folder_id) {
    return NextResponse.json({ error: "폴더 ID 누락" }, { status: 400 });
  }

  // 2. 해당 폴더 내 모든 이미지 row 조회(최신순)
  const result = await db.query(
    'SELECT * FROM images WHERE folder_id = $1 ORDER BY id DESC',
    [parseInt(folder_id)]
  );

  // 3. row 배열 반환
  return NextResponse.json(result.rows);
}
