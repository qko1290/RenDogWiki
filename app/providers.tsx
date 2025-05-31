// File: app/providers.tsx

/**
 * 인증 전역 Provider Wrapper
 * - next-auth의 SessionProvider를 글로벌로 적용
 */

'use client';

import { SessionProvider } from 'next-auth/react';

export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
