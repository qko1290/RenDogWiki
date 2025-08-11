// =============================================
// File: app/api/auth/logout/route.ts
// =============================================

import { NextResponse } from 'next/server';

export async function POST() {
  // JWT 토큰 쿠키 삭제 (즉시 만료)
  const res = NextResponse.json({ message: '로그아웃 완료' });
  res.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),  // 만료처리
  });
  return res;
}
