/**
 * 이메일 인증 토큰 검증 및 인증 처리 API (PostgreSQL 버전)
 * - GET: /api/verify/[token]
 *   - 유효한 토큰이면 인증 처리 및 토큰 삭제
 *   - 실패 시 에러 반환
 */

import { db } from '@/wiki/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  // 1. 토큰으로 사용자 조회 (Postgres: 파라미터는 $1)
  const result = await db.query(
    'SELECT * FROM users WHERE verification_token = $1',
    [token]
  );
  const users = result.rows;

  if (!Array.isArray(users) || users.length === 0) {
    // 2. 토큰이 없으면 에러
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 400 });
  }

  // 3. 인증 완료 처리
  await db.query(
    'UPDATE users SET verified = 1, verification_token = NULL WHERE verification_token = $1',
    [token]
  );

  // 4. 성공 메시지 반환
  return NextResponse.json({ message: '이메일 인증이 완료되었습니다.' });
}
