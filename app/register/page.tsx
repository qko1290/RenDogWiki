// =============================================
// File: C:\next\rdwiki\app\register\page.tsx
// =============================================
/**
 * 회원가입 페이지
 * - 이메일/아이디/비밀번호/마인크래프트 닉네임 입력
 * - /api/auth/register API 호출, 결과 메시지 표시
 */

'use client';

import { useState } from 'react';

export default function RegisterPage() {
  // 입력폼 
  const [form, setForm] = useState({
    email: '',         // 이메일
    username: '',      // 아이디
    password: '',      // 비밀번호
    minecraftName: '', // 마인크래프트 닉네임
  });

  const [message, setMessage] = useState('');   // 결과 메시지
  const [loading, setLoading] = useState(false); // 중복 submit 방지

  /**
   * 입력값 변경 핸들러
   * - name 속성(key) 기준으로 값 업데이트
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /**
   * 폼 제출
   * - /api/auth/register에 POST 요청
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // API 호출
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (res.ok) {
      // 회원가입 성공(이메일 인증 필요)
      setMessage('회원가입 성공! 이메일을 확인해주세요.');
      setForm({ email: '', username: '', password: '', minecraftName: '' });
    } else {
      // 실패(에러 메시지)
      setMessage(`${data.error || '회원가입 실패'}`);
    }
    setLoading(false);
  };

  // 렌더링
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
      <h1 className="text-2xl font-bold mb-4">회원가입</h1>
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-800 p-6 rounded shadow-md w-96 space-y-4"
      >
        {/* 이메일 입력 */}
        <div>
          <label className="block mb-1">이메일</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded bg-zinc-700 text-white"
          />
        </div>
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
        {/* 마인크래프트 닉네임 입력 */}
        <div>
          <label className="block mb-1">마인크래프트 닉네임</label>
          <input
            type="text"
            name="minecraftName"
            value={form.minecraftName}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded bg-zinc-700 text-white"
          />
        </div>
        {/* 가입 버튼 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-cyan-600 hover:bg-cyan-500 transition py-2 rounded mt-2"
        >
          {loading ? '처리 중...' : '가입하기'}
        </button>
        {/* 결과 메시지 */}
        {message && <p className="text-sm mt-2 text-center">{message}</p>}
      </form>
    </div>
  );
}
