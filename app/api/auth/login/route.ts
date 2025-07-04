/**
 * 로그인 API (PostgreSQL 버전)
 * - POST: 아이디/비밀번호로 로그인 시도
 *   - 존재하지 않는 아이디, 인증 미완료, 비밀번호 불일치 등 분기
 *   - JWT 토큰을 HttpOnly 쿠키로 반환
 */

import { db } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

type UserRow = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
  password_hash: string;
  verified: boolean;
};

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  // 1. 사용자 조회 (Postgres: 파라미터 $1)
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  const rows = result.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    // 2. 아이디가 없으면 에러
    return NextResponse.json({ error: '존재하지 않는 아이디입니다.' }, { status: 401 });
  }

  const user = rows[0] as UserRow;

  if (!user.verified) {
    // 3. 이메일 인증 필요
    return NextResponse.json({ error: '이메일 인증이 필요합니다.' }, { status: 403 });
  }

  // 4. 비밀번호 비교
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
  }

  // 5. JWT 토큰 생성
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

  // 6. HttpOnly 쿠키로 설정
  const res = NextResponse.json({ message: '로그인 성공' });
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7일
  });

  return res;
}
