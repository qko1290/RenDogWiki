'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');

  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">🔒 Microsoft 로그인</h1>

      <button
        onClick={() => signIn('microsoft')}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-6"
      >
        Microsoft로 로그인
      </button>

      <div className="mt-6 border-t pt-4">
        <p className="mb-2 text-sm text-gray-600">로그인이 차단되시나요?</p>
        <input
          className="border px-2 py-1 rounded"
          placeholder="이메일을 입력하세요"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="ml-2 bg-green-600 text-white px-3 py-1 rounded"
          onClick={async () => {
            const res = await fetch('/api/invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name: email }),
            });
            if (res.ok) {
              alert('초대 이메일이 전송되었습니다.');
            } else {
              alert('초대 요청 실패');
            }
          }}
        >
          초대 요청
        </button>
      </div>
    </div>
  );
}
