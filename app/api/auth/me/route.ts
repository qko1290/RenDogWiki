/**
 * 현재 로그인 유저 정보 & 회원탈퇴
 * - GET: 쿠키의 JWT → id만 신뢰 → DB에서 최신 레코드 반환
 * - DELETE: 비밀번호 확인 후 사용자 삭제 + 토큰 만료
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/app/wiki/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET() {
  const auth = getAuthUser();
  if (!auth) return NextResponse.json({ loggedIn: false }, { status: 401 });

  const rows = await sql`
    SELECT id, username, email, minecraft_name, role
    FROM users WHERE id = ${auth.id}
  `;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ loggedIn: false }, { status: 401 });
  }

  return NextResponse.json({ loggedIn: true, user: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthUser();
  if (!auth) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: '비밀번호가 필요합니다.' }, { status: 400 });

  const rows = await sql`SELECT id, password_hash FROM users WHERE id = ${auth.id}`;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  const ok = await bcrypt.compare((password as string), (rows[0] as any).password_hash);
  if (!ok) return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });

  await sql`DELETE FROM users WHERE id = ${auth.id}`;

  const res = NextResponse.json({ message: '탈퇴 완료' });
  res.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
  return res;
}

