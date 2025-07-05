// =============================================
// File: C:\next\rdwiki\app\login\page.tsx
// =============================================
/**
 * 위키 로그인 페이지
 * - 아이디/비밀번호 입력 -> /api/auth/login에 POST
 * - 성공시 안내 메시지 -> 2초 후 /wiki로 이동
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// LoginPage 컴포넌트 (메인 함수)
export default function LoginPage() {
  // -상태 정의 (입력값, 메시지, 로딩)
  const [form, setForm] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 입력값 핸들러(아이디/비번 input 모두 처리)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 로그인 요청 (submit 핸들러)
  // - API 호출 -> 성공시 안내/이동, 실패시 에러 출력
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 로그인 API 호출 
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    //  결과 처리
    const data = await res.json();
    if (res.ok) {
      setMessage('로그인 성공! 잠시 후 이동합니다...');
      setTimeout(() => router.push('/wiki'), 2000); // 2초 후 이동
    } else {
      setMessage(`${data.error || '로그인 실패'}`);
    }

    setLoading(false);
  };

  // 렌더링
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
      {/* 상단 제목 */}
      <h1 className="text-2xl font-bold mb-4">로그인</h1>

      {/* 로그인 폼 */}
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-800 p-6 rounded shadow-md w-96 space-y-4"
      >
        {/* 아이디 입력 */}
        <div>
          <label className="block mb-1">아이디</label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded bg-zinc-700 text-white"
          />
        </div>
        {/* 비밀번호 입력 */}
        <div>
          <label className="block mb-1">비밀번호</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded bg-zinc-700 text-white"
          />
        </div>
        {/* 로그인 버튼 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-cyan-600 hover:bg-cyan-500 transition py-2 rounded mt-2"
        >
          {loading ? '처리 중...' : '로그인'}
        </button>
        {/* 로그인/에러 메시지 */}
        {message && (
          <p className="text-sm mt-2 text-center">{message}</p>
        )}
      </form>
    </div>
  );
}
