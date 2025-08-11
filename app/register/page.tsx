'use client';

import { useState } from 'react';
import WikiHeader from '@/components/common/Header'; // 로그인과 동일
import '@wiki/css/login.css';

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
      setMessage('회원가입 성공! 이메일을 확인해주세요.');
      setForm({ email: '', username: '', password: '', minecraftName: '' });
    } else {
      setMessage(data?.error || '회원가입 실패');
    }
    setLoading(false);
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
                {/* 이메일 */}
                <div className="login-input-group">
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    className="login-input"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                    placeholder=" "
                    spellCheck={false}
                  />
                  <label htmlFor="email" className="login-label">
                    이메일
                  </label>
                  <span className="login-underline"></span>
                </div>
                {/* 아이디 */}
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
                    placeholder=" "
                    spellCheck={false}
                  />
                  <label htmlFor="username" className="login-label">
                    아이디
                  </label>
                  <span className="login-underline"></span>
                </div>
                {/* 비밀번호 */}
                <div className="login-input-group">
                  <input
                    type="password"
                    name="password"
                    id="password"
                    required
                    className="login-input"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder=" "
                    spellCheck={false}
                  />
                  <label htmlFor="password" className="login-label">
                    비밀번호
                  </label>
                  <span className="login-underline"></span>
                </div>
                {/* 마인크래프트 닉네임 */}
                <div className="login-input-group">
                  <input
                    type="text"
                    name="minecraftName"
                    id="minecraftName"
                    required
                    className="login-input"
                    value={form.minecraftName}
                    onChange={handleChange}
                    autoComplete="off"
                    placeholder=" "
                    spellCheck={false}
                  />
                  <label htmlFor="minecraftName" className="login-label">
                    마인크래프트 닉네임
                  </label>
                  <span className="login-underline"></span>
                </div>
              </div>
              <div id="submit-button-cvr">
                <button
                  id="submit-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? '처리 중...' : '가입하기'}
                </button>
              </div>
              {message && <p className="login-message">{message}</p>}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
