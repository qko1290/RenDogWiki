// =============================================
// File: app/api/auth/login/route.ts
// (JWT payload 최소화: sub/id/role만 포함, 닉/이메일 제거)
// =============================================
import { sql } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';

// JWT 비밀키
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// DB 조회 결과 타입
type Role = 'guest' | 'writer' | 'admin';
type UserRow = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
  password_hash: string;
  verified: boolean;
  role: Role | string | null;
};

export async function POST(req: NextRequest) {
  try {
    // 1) 입력 파싱
    const body = await req.json().catch(() => null);
    const rawUsername = typeof body?.username === 'string' ? body.username : '';
    const username = rawUsername.trim();
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 2) 사용자 조회 (role 포함)
    const rows = (await sql`
      SELECT id, username, email, minecraft_name, password_hash, verified, role
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `) as unknown as UserRow[];

    // 3) 아이디 없음
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: '존재하지 않는 아이디입니다.' },
        { status: 401 }
      );
    }

    const user = rows[0];

    // 4) 이메일 인증 확인
    if (!user.verified) {
      return NextResponse.json(
        { error: '이메일 인증이 필요합니다.' },
        { status: 403 }
      );
    }

    // 5) 비밀번호 검증
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    // 6) JWT 생성 (변하는 값 제외)
    const role = (user.role ?? 'guest') as Role;
    const token = jwt.sign(
      {
        sub: user.id,   // 표준 subject
        id: user.id,    // 기존 getAuthUser 호환용
        role,           // 권한만 유지
        // username/minecraft_name/email은 넣지 않음
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 7) 쿠키 저장
    const res = NextResponse.json({ message: '로그인 성공' });
    res.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error('[auth/login] unexpected error:', err);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
