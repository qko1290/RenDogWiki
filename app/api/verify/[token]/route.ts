// app/api/verify/[token]/route.ts
import { sql } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  // 토큰 존재 확인 (선택)
  const users = await sql`SELECT id FROM users WHERE verification_token = ${token}`;
  if (!Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 400 });
  }

  // ✅ boolean으로 업데이트 + 토큰 제거
  const updated =
    await sql`
      UPDATE users
      SET verified = ${true},               -- or: VERIFIED = TRUE
          verification_token = ${null}
      WHERE verification_token = ${token}
      RETURNING id
    `;

  if (!Array.isArray(updated) || updated.length === 0) {
    return NextResponse.json({ error: '인증 처리에 실패했습니다.' }, { status: 400 });
  }

  return NextResponse.json({ message: '이메일 인증이 완료되었습니다.' });
}
