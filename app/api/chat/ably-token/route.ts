// =============================================
// File: app/api/chat/ably-token/route.ts
// =============================================
/**
 * Ably 토큰 요청 엔드포인트
 * - GET -> Ably REST SDK로 tokenRequest 생성 후 그대로 반환
 * - clientId -> 로그인 유저면 "user:<id>", 아니면 "anon"
 * - capability -> 특정 채널에 한해 publish/subscribe 허용
 * - 보안 메모 -> 응답은 실시간 성격이라 캐시 금지
 */

import { NextResponse } from 'next/server';
import Ably from 'ably';
import { getAuthUser } from '@/wiki/lib/auth';

export async function GET() {
  try {
    // 1) 환경 변수 확인 -> 키가 없으면 서버 미설정 상태
    const KEY = process.env.ABLY_API_KEY;
    if (!KEY) {
      return NextResponse.json(
        { error: 'no-ably-key' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 형식 경고는 로그로만 남긴다(동작은 계속 진행)
    if (!KEY.includes(':')) {
      console.warn('[ably-token] ABLY_API_KEY 형식이 비정상 같습니다(콜론 누락?).');
    }

    // 2) 사용자 식별 -> 토큰에 clientId 부여
    const me = getAuthUser();
    const clientId = me ? `user:${me.id}` : 'anon';

    // 3) Ably REST 인스턴스 생성
    const client = new Ably.Rest(KEY);

    // 4) 토큰 요청 생성 -> ttl(ms), capability(JSON string)
    const tokenRequest = await client.auth.createTokenRequest({
      clientId,
      ttl: 1000 * 60 * 60, // 1시간
      capability: JSON.stringify({
        'rdwiki-chat': ['publish', 'subscribe'],
      }),
    });

    // 5) 그대로 반환(클라이언트는 이 객체로 auth 요청 수행)
    return NextResponse.json(tokenRequest, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    console.error('/api/chat/ably-token error:', e);
    return NextResponse.json(
      { error: 'ably-token-failed', detail: String(e?.message || e) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
