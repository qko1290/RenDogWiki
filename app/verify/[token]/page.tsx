// File: app/verify/[token]/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyPage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const verify = async () => {
      const res = await fetch(`/api/verify/${params.token}`);
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || '인증 성공!');
        setTimeout(() => router.push('/login'), 3000); // 3초 후 로그인 페이지로 이동
      } else {
        setStatus('error');
        setMessage(data.error || '인증 실패');
      }
    };

    verify();
  }, [params.token, router]);

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col justify-center items-center">
      <h1 className="text-2xl font-bold mb-4">이메일 인증</h1>
      {status === 'loading' && <p>처리 중입니다...</p>}
      {status !== 'loading' && <p>{message}</p>}
      {status === 'success' && <p className="mt-2 text-sm text-gray-400">(잠시 후 로그인 페이지로 이동합니다)</p>}
    </div>
  );
}
