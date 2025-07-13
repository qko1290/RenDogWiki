// =============================================
// File: app/api/image/rename/route.ts
// =============================================
/**
 * 이미지 이름(파일명) 수정 API
 * - [PATCH] 이미지 id, 변경할 name 받아 파일명 수정
 * - id, name 필수. 누락시 400 반환
 * - 에러: 입력값 누락(400), DB 에러(500 등)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db'; // DB

/**
 * [이미지 이름 수정] PATCH
 * - 입력: id(이미지 pk), name(변경할 이름)
 * - 1. 입력값 누락(400)
 * - 2. DB에서 이름 수정
 */
export async function PATCH(req: NextRequest) {
  // 1. 입력값 파싱 및 체크
  const { id, name } = await req.json();
  if (!id || !name) {
    return NextResponse.json({ error: 'id와 name이 필요합니다.' }, { status: 400 });
  }

  // 2. DB에서 이미지 이름 변경
  await sql`UPDATE images SET name = ${name} WHERE id = ${id}`;

  // 3. 성공 응답 반환
  return NextResponse.json({ success: true });
}
