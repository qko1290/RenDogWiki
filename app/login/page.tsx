// File: C:\next\rdwiki\app\login\page.tsx
'use client';
/**
 * 로그인 페이지
 * - 아이디/비밀번호 입력 및 /api/auth/login 호출
 * - 아이디/비밀번호에 한글 입력 차단
 * - 성공 시 /wiki로 이동, 결과 메시지는 페이지 내에 표시
 * - 외부 API/라우트/스타일 계약 유지
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import WikiHeader from '@/components/common/Header';
import '@/wiki/css/login.css';

/* ===== 한글 차단 유틸 ===== */
const HANGUL_GLOBAL = /[\uAC00-\uD7A3\u1100-\u11FF\u3131-\u318E]/g;
const stripHangul = (s: string) => s.replace(HANGUL_GLOBAL, '');
/* ======================== */

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // 아이디/비번 모두 한글 차단
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const v = (name === 'username' || name === 'password') ? stripHangul(value) : value;
    setForm(prev => ({ ...prev, [name]: v }));
  };

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
        setTimeout(() => router.push('/wiki'), 2000);
      } else {
        setMessage(data.error || '로그인 실패');
      }
    } catch {
      setMessage('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-root">
      <WikiHeader user={null} />

      <main className="login-bg">
        <div id="form-ui">
          <form id="form" onSubmit={handleSubmit} autoComplete="on">
            <div id="form-body">
              <div id="welcome-lines">
                <div id="welcome-line-1">RDWIKI</div>
                <div id="welcome-line-2">렌독서버의 모든 것</div>
              </div>

              <div id="input-area">
                {/* --- 아이디 입력 --- */}
                <div className="login-input-group">
                  <input
                    type="text"
                    name="username"
                    id="username"
                    required
                    className="login-input"
                    value={form.username}
                    onChange={handleChange}
                    autoComplete="username"
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder=" "
                    spellCheck={false}
                  />
                  <label htmlFor="username" className="login-label">아이디</label>
                  <span className="login-underline"></span>
                </div>

                {/* --- 비밀번호 입력 --- */}
                <div className="login-input-group">
                  <input
                    type="password"
                    name="password"
                    id="password"
                    required
                    className="login-input"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    placeholder=" "
                    spellCheck={false}
                  />
                  <label htmlFor="password" className="login-label">비밀번호</label>
                  <span className="login-underline"></span>
                </div>
              </div>

              <div id="submit-button-cvr">
                <button id="submit-button" type="submit" disabled={loading}>
                  {loading ? '처리 중...' : '로그인'}
                </button>
              </div>

              <div id="forgot-pass">
                <a href="#">비밀번호를 잊으셨나요?</a>
              </div>

              {message && (
                <p className="login-message" aria-live="polite">
                  {message}
                </p>
              )}
            </div>
          </form>
        </div>
      </main>

      <style jsx global>{`
        .login-message { white-space: pre-line; }
      `}</style>
    </div>
  );
}
