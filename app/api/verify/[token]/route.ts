// File: app/api/verify/[token]/route.ts

import { db } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  const [users] = await db.query('SELECT * FROM users WHERE verification_token = ?', [token]);

  if (!Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 400 });
  }

  // 인증 완료 처리
  await db.query(
    'UPDATE users SET verified = 1, verification_token = NULL WHERE verification_token = ?',
    [token]
  );

  return NextResponse.json({ message: '이메일 인증이 완료되었습니다.' });
}
