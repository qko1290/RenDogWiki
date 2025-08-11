/**
 * 비밀번호 변경
 * - PUT body: { currentPassword, newPassword }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/app/wiki/lib/auth';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest) {
  const auth = getAuthUser();
  if (!auth) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '현재/새 비밀번호를 입력하세요.' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: '새 비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  }

  const rows = await sql`SELECT password_hash FROM users WHERE id = ${auth.id}`;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  const ok = await bcrypt.compare(currentPassword, (rows[0] as any).password_hash);
  if (!ok) return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 401 });

  const hashed = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE users SET password_hash = ${hashed} WHERE id = ${auth.id}`;

  return NextResponse.json({ message: '비밀번호가 변경되었습니다.' });
}
