// =============================================
// File: app/api/auth/me/route.ts
// =============================================
/**
 * 현재 로그인된 유저 정보 반환 API
 * - GET: 인증된 유저 정보 반환
 *   - 인증 실패 시 { loggedIn: false } 반환 (401)
 *   - 인증 성공 시 { loggedIn: true, user } 반환
 * - 호출 위치: 클라이언트에서 로그인 여부/유저 정보 확인 등에 사용
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/app/wiki/lib/auth';

export async function GET() {
  // 현재 인증된 유저 정보 조회 (쿠키/JWT에서 파싱)
  const user = getAuthUser();
  if (!user) return NextResponse.json({ loggedIn: false }, { status: 401 });
  return NextResponse.json({ loggedIn: true, user });
}
