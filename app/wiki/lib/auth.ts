// =============================================
// File: C:\next\rdwiki\app\wiki\lib\auth.ts
// =============================================
/**
 * JWT 인증 유틸리티 함수
 * - 쿠키에 저장된 JWT 토큰을 읽어 유저 정보(AuthUser)를 반환
 * - 인증 실패 시(null) 처리
 */

import { cookies } from 'next/headers'; // Next.js 서버에서 쿠키 읽기
import jwt from 'jsonwebtoken';         // JWT 토큰 디코딩

// JWT 비밀키 (.env에 설정)
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// 인증 유저 타입
export type AuthUser = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
};

/**
 * [서버 사이드] 로그인 유저 정보 반환
 * - 쿠키의 'token'에서 JWT 추출
 * - 토큰 검증 후 AuthUser 반환 (검증 실패시 null)
 */
export function getAuthUser(): AuthUser | null {
  // 1. 토큰 읽기
  const token = cookies().get('token')?.value;

  // 2. 토큰 없으면 인증 실패(null)
  if (!token) return null;

  try {
    // 3. 토큰 검증 및 디코딩
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (err) {
    // 4. 토큰 만료/변조/오류 시 인증 실패(null)
    return null;
  }
}
