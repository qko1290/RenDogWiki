// =============================================
// File: app/login/page.tsx
// =============================================
/**
 * 위키 로그인 페이지
 * - 아이디/비밀번호 입력받아 /api/auth/login으로 POST
 * - 성공시 안내 메시지 → 2초 후 /wiki로 자동 이동
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/wiki/css/login.css'; // 로그인 전용 CSS

// LoginPage 컴포넌트
export default function LoginPage() {
  // 입력 상태: username(아이디), password(비밀번호)
  const [form, setForm] = useState({ username: '', password: '' });
  // 메시지(로그인 성공/실패 안내), 로딩 플래그
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // input 변화 핸들러: name="username"/"password" 자동 처리
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // 로그인 submit 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage('로그인 성공! 잠시 후 이동합니다...');
        setTimeout(() => router.push('/wiki'), 2000); // 2초 후 이동
      } else {
        setMessage(data.error || '로그인 실패');
      }
    } catch (err) {
      setMessage('서버 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  // UI 렌더
  return (
    <div className="login-bg">
      <div className="login-container">
        <h1 className="login-title">로그인</h1>
        <form onSubmit={handleSubmit} className="login-form">
          {/* 아이디 */}
          <div className="login-field">
            <label className="login-label" htmlFor="username">아이디</label>
            <input
              id="username"
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className="login-input"
              autoFocus
              autoComplete="username"
            />
          </div>
          {/* 비밀번호 */}
          <div className="login-field">
            <label className="login-label" htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className="login-input"
              autoComplete="current-password"
            />
          </div>
          {/* 버튼 및 메시지 */}
          <button
            type="submit"
            disabled={loading}
            className="login-btn"
          >
            {loading ? '처리 중...' : '로그인'}
          </button>
          {message && <p className="login-message">{message}</p>}
        </form>
      </div>
    </div>
  );
}
