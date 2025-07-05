// =============================================
// File: app/verify/[token]/page.tsx
// =============================================
/**
 * 이메일 인증 페이지
 * - URL의 [token] 파라미터로 인증 API 호출
 * - 성공/실패 메시지 및 상태 표시
 * - 인증 성공 시 3초 후 /login으로 자동 이동
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyPage({ params }: { params: { token: string } }) {
  // 상태: 로딩/성공/실패 및 메시지 관리
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();

  /**
   * mount/토큰 변경 시 인증 API 호출
   * - /api/verify/[token] 로 GET 요청
   * - 성공: status 'success', 메시지 출력, 3초 후 /login으로 이동
   * - 실패: status 'error', 에러 메시지 출력
   */
  useEffect(() => {
    const verify = async () => {
      // 인증 요청 
      const res = await fetch(`/api/verify/${params.token}`);
      const data = await res.json();

      if (res.ok) {
        // 인증 성공
        setStatus('success');
        setMessage(data.message || '인증 성공!');
        // 3초 뒤 로그인 페이지로 자동 이동
        setTimeout(() => router.push('/login'), 3000);
      } else {
        // 인증 실패
        setStatus('error');
        setMessage(data.error || '인증 실패');
      }
    };

    verify();
  }, [params.token, router]);

  // UI 렌더
  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col justify-center items-center">
      <h1 className="text-2xl font-bold mb-4">이메일 인증</h1>
      {/* 처리 중 상태 */}
      {status === 'loading' && <p>처리 중입니다...</p>}
      {/* 결과 메시지 */}
      {status !== 'loading' && <p>{message}</p>}
      {/* 성공 안내 */}
      {status === 'success' && (
        <p className="mt-2 text-sm text-gray-400">
          (잠시 후 로그인 페이지로 이동합니다)
        </p>
      )}
    </div>
  );
}
