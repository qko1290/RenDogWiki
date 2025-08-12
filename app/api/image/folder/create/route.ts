// =============================================
// File: app/api/image/folder/create/route.ts
// =============================================
/**
 * 이미지 폴더 생성 API
 * - [POST] name(폴더명), parent_id(소속 폴더 id) 입력받아 새 폴더 생성
 * - 동일 parent 내에 같은 폴더명 중복 불가(중복시 409 반환)
 * - 폴더 생성자는 로그인된 유저(minecraft_name)
 * - 에러: 로그인 필요(401), 필수값 누락(400), 중복 폴더명(409)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';             // DB
import { getAuthUser } from '@/wiki/lib/auth';   // 로그인 유저 반환

/**
 * [폴더 생성] POST
 * - name(필수), parent_id(필수, null/숫자)
 * - 1. 로그인 필요(getAuthUser)
 * - 2. 필수값 누락 체크
 * - 3. 같은 parent 내 name 중복 체크(409)
 * - 4. DB에 폴더 row 생성, id 반환
 * - 5. 성공 시 ok: true + 폴더 정보 반환
 */
export async function POST(req: NextRequest) {
  // 1. 입력값 파싱
  const { name, parent_id } = await req.json();

  // 2. 로그인 인증 필요
  const user = getAuthUser();
  if (!user)
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const normParentId = ((): number | null => {
    if (parent_id === null || parent_id === undefined || parent_id === '') return null;
    const n = Number(parent_id);
    if (!Number.isFinite(n) || n <= 0) return null; // 0, NaN 모두 null 취급
    return n;
  })();

  // 3. 필수값 체크(name, parent_id 모두 필수)
  if (!name || parent_id === undefined)
    return NextResponse.json({ error: "필수값 누락" }, { status: 400 });

  // 4. 같은 parent 내 중복 폴더명 체크
  const existsResult = await sql`
    SELECT id FROM image_folders
    WHERE parent_id IS NOT DISTINCT FROM ${normParentId} AND name = ${name}
    LIMIT 1
  `;
  if (existsResult.length > 0)
    return NextResponse.json({ error: "중복 폴더명" }, { status: 409 });

  // 5. 폴더 생성(DB insert, uploader는 유저 닉네임)
  const insertResult = await sql`
    INSERT INTO image_folders (name, parent_id, uploader)
    VALUES (${name}, ${normParentId}, ${user.minecraft_name}) RETURNING id
  `;
  const folderId = insertResult[0].id;

  // 6. 성공 응답
  return NextResponse.json({
    ok: true,
    folder: {
      id: folderId,
      name,
      parent_id,
      uploader: user.minecraft_name
    }
  });
}
