// =============================================
// File: app/components/chat/ably-singleton.ts
// =============================================
/**
 * Ably Realtime 클라이언트 싱글톤
 * - getAbly() -> 전역에서 단 하나의 Ably.Realtime 인스턴스 반환
 * - 개발 중 HMR에서도 인스턴스가 늘어나지 않도록 globalThis에 저장
 * - 브라우저 전용 모듈이므로 "use client" 선언
 */

'use client';

import Ably from 'ably';

// HMR에서도 유지되는 전역 슬롯
declare global {
  // eslint-disable-next-line no-var
  var __ABLY_SINGLETON__: Ably.Realtime | undefined;
}

function createAbly(): Ably.Realtime {
  return new Ably.Realtime({
    // 서버 토큰 엔드포인트 호출(캐시 회피용 ts 쿼리)
    authUrl: `/api/chat/ably-token?ts=${Date.now()}`,
    // 내가 보낸 메시지도 수신할지 여부
    echoMessages: true,
    // 네트워크 단절 후 재시도 간격(ms)
    disconnectedRetryTimeout: 4000,
    // 필요에 따라 옵션 추가 가능: recover, transports, tls 등
  });
}

/**
 * 전역 Ably 인스턴스 반환
 * - 최초 호출 시 생성 -> 이후 동일 객체 재사용
 * - 서버 환경에서 호출되면 에러(브라우저 전용)
 */
export function getAbly(): Ably.Realtime {
  if (typeof window === 'undefined') {
    throw new Error('getAbly()는 클라이언트에서만 호출해야 합니다.');
  }
  if (!globalThis.__ABLY_SINGLETON__) {
    globalThis.__ABLY_SINGLETON__ = createAbly();
  }
  return globalThis.__ABLY_SINGLETON__;
}

/**
 * 필요 시 Ably 연결을 정리하고 싱글톤 해제
 * - 로그아웃/앱 완전 종료 등의 상황에서 사용
 */
export function resetAbly() {
  try {
    globalThis.__ABLY_SINGLETON__?.close();
  } finally {
    globalThis.__ABLY_SINGLETON__ = undefined;
  }
}
