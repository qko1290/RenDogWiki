// =============================================
// File: app/api/auth/login/route.ts
// =============================================
/**
 * 로그인 API 라우트
 * - POST: 아이디와 비밀번호로 로그인 시도
 *   - 로그인 성공 시 JWT 토큰을 HttpOnly 쿠키에 저장하여 반환
 * - 호출 위치: 회원 로그인 폼, 자동 로그인 처리 등에서 사용
 * - 유의사항:
 *   - 이메일 인증이 완료되어야 로그인 허용
 *   - JWT_SECRET 환경변수가 없으면 'default_secret' 사용
 */

import { db } from '@/wiki/lib/db'; // DB 유틸
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';      // 비밀번호 해시 검증
import jwt from 'jsonwebtoken';    // JWT 토큰 생성

// JWT 비밀키: .env에서 설정, 없을 경우 기본값 사용
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// DB 조회 결과 유저 타입 정의
type UserRow = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
  password_hash: string;
  verified: boolean;
};

/**
 * [로그인 요청] POST
 * - 아이디/비밀번호 입력값을 받아서 로그인 처리
 * - 예외 : 아이디 없음, 인증 미완료, 비밀번호 불일치
 * - 로그인 성공 시 JWT 토큰을 발급하여 HttpOnly 쿠키로 반환
 */
export async function POST(req: NextRequest) {
  // 1. 입력값 파싱
  const { username, password } = await req.json();

  // 입력값 누락 시 에러
  if (!username || !password) {
    return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  // 2. 사용자 조회
  // username이 일치하는 계정 찾기
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  const rows = result.rows;

  // 3. 아이디 없음 처리
  if (!Array.isArray(rows) || rows.length === 0) {
    // 계정이 존재하지 않을 때
    return NextResponse.json({ error: '존재하지 않는 아이디입니다.' }, { status: 401 });
  }

  // 4. 인증 여부 확인
  const user = rows[0] as UserRow;
  if (!user.verified) {
    // 인증 미완료
    return NextResponse.json({ error: '이메일 인증이 필요합니다.' }, { status: 403 });
  }

  // 5. 비밀번호 비교
  // 입력된 비밀번호와 DB의 해시값 비교
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
  }

  // 6. JWT 토큰 생성
  //   - user id, username, minecraft_name, email
  //   - 유효기간: 7일
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      minecraft_name: user.minecraft_name,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 7. JWT 토큰을 HttpOnly 쿠키에 저장
  // JS로 접근 불가, https 환경에서는 secure 옵션 적용
  // 모든 경로(/)에서 유효, 7일간 유지
  const res = NextResponse.json({ message: '로그인 성공' });
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7일
  });

  // 8. 성공 응답 반환
  return res;
}
