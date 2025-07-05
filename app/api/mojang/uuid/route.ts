// =============================================
// File: app/api/mojang/uuid/route.ts
// =============================================
/**
 * 마인크래프트 닉네임 -> Mojang UUID 변환 API
 * - [GET] 쿼리 파라미터 name으로 Mojang REST API 호출
 * - 외부 API(Mojang) 연결 실패/닉네임 불일치시 예외 처리
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * [UUID 조회] GET
 * - 입력: name(마인크래프트 닉네임, 쿼리 필수)
 * - 1. name 누락시 400
 * - 2. Mojang REST API 호출(닉네임 -> uuid)
 * - 3. 정상: { uuid: ... }
 * - 4. 닉네임 미존재/오류: 404
 * - 5. API 통신 실패: 500
 */
export async function GET(req: NextRequest) {
  // 1. 쿼리 파라미터 파싱/체크
  const name = req.nextUrl.searchParams.get('name');
  if (!name)
    return NextResponse.json({ error: '닉네임이 없습니다.' }, { status: 400 });

  try {
    // 2. Mojang API에 REST 요청
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${name}`);
    if (!res.ok)
      return NextResponse.json({ error: '유효하지 않은 닉네임입니다.' }, { status: 404 });

    // 3. 성공시 uuid 추출/반환
    const data = await res.json();
    return NextResponse.json({ uuid: data.id });
  } catch (e) {
    // 4. Mojang 서버/API 통신 에러 등
    return NextResponse.json({ error: 'Mojang API 요청 실패' }, { status: 500 });
  }
}
