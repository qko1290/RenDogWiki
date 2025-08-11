/**
 * 마인크래프트 닉네임 변경
 * - PATCH body: { newName }
 * - 절차: 인증 → 형식체크 → Mojang UUID 검증 → 중복검사 → 업데이트 → 새 JWT 재발급
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/app/wiki/lib/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

export async function PATCH(req: NextRequest) {
  const auth = getAuthUser();
  if (!auth) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { newName } = await req.json();
  if (!newName || typeof newName !== 'string') {
    return NextResponse.json({ error: '새 닉네임을 입력하세요.' }, { status: 400 });
  }

  const trimmed = newName.trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(trimmed)) {
    return NextResponse.json({ error: '닉네임 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  // Mojang 검증
  try {
    const r = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(trimmed)}`);
    if (!r.ok) return NextResponse.json({ error: '유효하지 않은 닉네임입니다.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Mojang API 오류' }, { status: 502 });
  }

  // 중복 검사
  const dup = await sql`
    SELECT id FROM users WHERE minecraft_name = ${trimmed} AND id <> ${auth.id}
  `;
  if (Array.isArray(dup) && dup.length > 0) {
    return NextResponse.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 409 });
  }

  // 업데이트
  await sql`UPDATE users SET minecraft_name = ${trimmed} WHERE id = ${auth.id}`;

  // 최신 유저 조회
  const rows = await sql`
    SELECT id, username, email, minecraft_name
    FROM users WHERE id = ${auth.id}
  `;
  const user = rows[0];

  // 새 JWT 재발급(클레임에 minecraft_name을 계속 담고 있으므로)
  const token = jwt.sign(
    { id: user.id, username: user.username, minecraft_name: user.minecraft_name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  const res = NextResponse.json({ message: '닉네임 변경 완료', user });
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
    