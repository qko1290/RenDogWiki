// =============================================
// File: app/api/verify/[token]/route.ts
// =============================================
/**
 * 이메일 인증 토큰 검증 및 인증 처리 API
 * - [GET] /api/verify/[token]
 *   - 유효한 인증 토큰 전달 시 사용자 인증(verified=1) 및 토큰 삭제
 *   - 실패 시 400 반환
 */

import { db } from '@/wiki/lib/db'; // DB
import { NextRequest, NextResponse } from 'next/server';

/**
 * [이메일 인증 처리] GET
 * - 입력: params.token
 * - 1. 토큰으로 users 테이블 조회
 * - 2. 토큰 일치 user 없으면 400 에러
 * - 3. 인증 완료 처리(verified=1, verification_token null)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // 1. 토큰 파라미터 추출
  const token = params.token;

  // 2. 토큰으로 사용자 조회
  const result = await db.query(
    'SELECT * FROM users WHERE verification_token = $1',
    [token]
  );
  const users = result.rows;

  // 3. 토큰 미존재 처리
  if (!Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 400 });
  }

  // 4. 인증 완료 처리(verified=1, 토큰 삭제)
  await db.query(
    'UPDATE users SET verified = 1, verification_token = NULL WHERE verification_token = $1',
    [token]
  );

  // 5. 성공 메시지 반환
  return NextResponse.json({ message: '이메일 인증이 완료되었습니다.' });
}
