// C:\next\rdwiki\app\register\page.tsx

'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    minecraftName: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage('✅ 회원가입 성공! 이메일을 확인해주세요.');
      setForm({ email: '', username: '', password: '', minecraftName: '' });
    } else {
      setMessage(`❌ ${data.error || '회원가입 실패'}`);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
      <h1 className="text-2xl font-bold mb-4">회원가입</h1>
      <form onSubmit={handleSubmit} className="bg-zinc-800 p-6 rounded shadow-md w-96 space-y-4">
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
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-cyan-600 hover:bg-cyan-500 transition py-2 rounded mt-2"
        >
          {loading ? '처리 중...' : '가입하기'}
        </button>
        {message && <p className="text-sm mt-2 text-center">{message}</p>}
      </form>
    </div>
  );
}
