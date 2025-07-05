// =============================================
// File: app/api/image/folder/rename/route.ts
// =============================================
/**
 * 이미지 폴더 이름 수정 API
 * - [PATCH] 폴더 id, 새로운 name 받아 이름 변경
 * - 로그인 필요(getAuthUser)
 * - 동일 parent 내 중복 이름 허용 안함(중복시 409)
 * - 에러: 미인증(401), 입력값 누락(400), 폴더 없음(404), 중복 폴더명(409)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';           // DB
import { getAuthUser } from '@/wiki/lib/auth';// 로그인 유저

/**
 * [폴더 이름 수정] PATCH
 * - 입력: id(폴더 pk), name(변경할 이름)
 * - 1. 로그인 체크(401)
 * - 2. 입력값 누락(400)
 * - 3. 폴더 존재 확인(404)
 * - 4. 동일 parent 내 name 중복 체크(409)
 * - 5. DB에서 이름 수정
 * - 6. 성공 시 ok: true 반환
 */
export async function PATCH(req: NextRequest) {
  // 1. 입력 파싱 및 인증 체크
  const { id, name } = await req.json();
  const user = getAuthUser();
  if (!user)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (!id || !name)
    return NextResponse.json({ error: "필수값 누락" }, { status: 400 });

  // 2. 기존 폴더 존재 여부 확인
  const folderResult = await db.query(
    'SELECT * FROM image_folders WHERE id = $1', [id]
  );
  const folder = folderResult.rows[0];
  if (!folder)
    return NextResponse.json({ error: "폴더 없음" }, { status: 404 });

  // 3. 동일 parent 내 중복 이름 체크(본인 제외)
  const existsResult = await db.query(
    'SELECT id FROM image_folders WHERE parent_id = $1 AND name = $2 AND id != $3 LIMIT 1',
    [folder.parent_id, name, id]
  );
  if (existsResult.rows.length > 0)
    return NextResponse.json({ error: "중복 폴더명" }, { status: 409 });

  // 4. DB에서 폴더 이름 변경
  await db.query(
    'UPDATE image_folders SET name = $1 WHERE id = $2', [name, id]
  );

  // 5. 성공 응답
  return NextResponse.json({ ok: true });
}
