// =============================================
// File: app/api/realtime/token/route.ts
// =============================================
/**
 * Ably 실시간 토큰 발급
 * - GET -> 로그인된 유저의 id를 clientId로 사용해 TokenRequest 반환
 * - 실패 시 401(미인증) / 500(토큰 발급 실패)
 * - 응답은 캐시 금지
 */

import { NextResponse } from 'next/server';
import { ablyRest } from '@/wiki/lib/ably';
import { getAuthUser } from '@/wiki/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const user = getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const tokenRequest = await ablyRest.auth.createTokenRequest({
      clientId: String(user.id),
      // 필요 시 TTL/Capability를 여기에 지정 가능(현 동작 유지 위해 기본값 사용)
      // ttl: 1000 * 60 * 60,
      // capability: JSON.stringify({ 'rdwiki-chat': ['publish', 'subscribe'] }),
    });

    return NextResponse.json(tokenRequest, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('[realtime/token GET] error:', err);
    return NextResponse.json(
      { error: 'token-request-failed', detail: String(err?.message || err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
