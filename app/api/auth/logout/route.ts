// =============================================
// File: app/api/auth/logout/route.ts
// =============================================
/**
 * 로그아웃 API
 * - 목적: 로그인 시 발급한 JWT 쿠키를 즉시 만료시켜 세션 종료
 * - 동작: token 쿠키를 빈 값으로 설정하고 만료일을 과거로 -> 브라우저가 삭제
 * - 주의: 로그인에서 설정한 쿠키 옵션(sameSite/secure/path)이 삭제 시에도 동일해야 확실히 지워짐
 */

import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // 쿠키 삭제는 "같은 옵션"으로 덮어서 만료시키는 게 확실함
    const res = NextResponse.json(
      { message: '로그아웃 완료' },
      { headers: { 'Cache-Control': 'no-store' } }
    );

    res.cookies.set('token', '', {
      httpOnly: true,                       // JS에서 접근 불가
      sameSite: 'lax',                      // 로그인과 동일 옵션 유지
      secure: process.env.NODE_ENV === 'production',
      path: '/',                            // 전체 경로에서 효력
      maxAge: 0,                            // 즉시 만료
      expires: new Date(0),                 // 백업 방어선(1970-01-01)
    });

    res.cookies.set('rd_role', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    return res;
  } catch (err) {
    // 예기치 못한 에러 -> 서버 에러로 정리
    console.error('[auth/logout] unexpected error:', err);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}