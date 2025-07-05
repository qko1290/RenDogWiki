// =============================================
// File: app/api/image/folder/list/route.ts
// =============================================
/**
 * 이미지 폴더 목록 조회 API (상위 폴더별 or 전체)
 * - [GET] 쿼리 파라미터 parent_id로 하위 폴더만 조회(없으면 전체 폴더)
 * - 사용처: 이미지 탐색기/관리 페이지 폴더 트리, 폴더 선택 드롭다운 등
 * - 반환값: image_folders 테이블 row 배열 (ORDER BY id ASC)
 * - 주의: parent_id 없으면 전체 row 반환(트리 초기 렌더 등)
 * - parent_id는 정수로 변환해서 사용
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db'; // DB 쿼리(Postgres 등)

/**
 * [폴더 리스트 조회] GET
 *   parent_id 있으면 해당 id 하위 폴더만 반환
 *   없으면 전체 폴더 반환
 *   반환: image_folders 테이블 row 배열
 */
export async function GET(req: NextRequest) {
  // 1. 쿼리 파라미터 파싱 
  const { searchParams } = new URL(req.url);
  const parent_id = searchParams.get("parent_id");

  let result;
  // 2. parent_id에 따라 분기
  if (!parent_id) {
    // parent_id 없으면 전체 폴더 반환
    result = await db.query(
      'SELECT * FROM image_folders ORDER BY id ASC'
    );
  } else {
    // parent_id 있으면 해당 하위 폴더만 반환
    result = await db.query(
      'SELECT * FROM image_folders WHERE parent_id = $1 ORDER BY id ASC',
      [parseInt(parent_id)]
    );
  }

  // 3. row 배열 반환
  return NextResponse.json(result.rows);
}
