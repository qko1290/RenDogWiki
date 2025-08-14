// =============================================
// File: app/api/auth/login/route.ts
// =============================================
/**
 * 로그인 API 라우트
 * - POST로 username/password를 받아 로그인 처리 -> 성공 시 JWT를 HttpOnly 쿠키로 반환
 * - 실패 케이스: 계정 없음 / 이메일 미인증 / 비밀번호 불일치
 * - 동작 보존 우선, 보안/안정성만 보강
 *
 * 메모
 * - req.json()은 실패 가능 -> 안전 파싱
 * - DB는 필요한 컬럼만 조회(LIMIT 1) -> 불필요 전송 줄이기
 * - 쿠키는 httpOnly + sameSite=lax + (prod) secure -> XSS/CSRF 완화
 */

import { sql } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// JWT 비밀키: .env에 없으면 개발 편의용 기본값 사용(운영환경에선 반드시 설정 권장)
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// DB 조회 결과 타입
type UserRow = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
  password_hash: string;
  verified: boolean;
};

export async function POST(req: NextRequest) {
  try {
    // 1) 입력 파싱 -> json 파싱 실패/타입 불일치 대비
    const body = await req.json().catch(() => null);
    const rawUsername = typeof body?.username === 'string' ? body.username : '';
    const username = rawUsername.trim(); // 사용자가 공백을 붙여도 처리
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      // 필수값 누락
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 2) 사용자 조회 -> 필요한 컬럼만 + LIMIT 1
    const rows = (await sql`
      SELECT id, username, email, minecraft_name, password_hash, verified
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `) as unknown as UserRow[];

    // 3) 아이디 없음 처리
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: '존재하지 않는 아이디입니다.' },
        { status: 401 }
      );
    }

    // 4) 인증 여부 확인
    const user = rows[0];
    if (!user.verified) {
      return NextResponse.json(
        { error: '이메일 인증이 필요합니다.' },
        { status: 403 }
      );
    }

    // 5) 비밀번호 비교 -> bcrypt 해시 검증
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    // 6) JWT 생성 -> payload: id/username/minecraft_name/email, 유효 7일
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

    // 7) 쿠키 저장 -> httpOnly + sameSite=lax + (prod) secure, 전체 경로(/), 7일
    const res = NextResponse.json({ message: '로그인 성공' });
    res.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    // 8) 성공 응답
    return res;
  } catch (err) {
    // 예기치 못한 오류 -> 서버 에러로 정리
    console.error('[auth/login] unexpected error:', err);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
