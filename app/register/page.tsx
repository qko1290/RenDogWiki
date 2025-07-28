// =============================================
// File: C:\next\rdwiki\app\register\page.tsx
// =============================================
/**
 * 회원가입 페이지(클라이언트)
 * - 이메일/아이디/비밀번호/마인크래프트 닉네임 입력
 * - /api/auth/register API POST 호출
 * - 성공/실패 메시지 출력, 중복 제출 방지
 */

'use client';

import { useState } from 'react';
import '@wiki/css/register.css'; // 스타일 분리(외부 css 사용)

/**
 * 회원가입 폼 컴포넌트
 */
export default function RegisterPage() {
  // 입력폼 상태(4개)
  const [form, setForm] = useState({
    email: '',         // 이메일
    username: '',      // 아이디(로그인용)
    password: '',      // 비밀번호
    minecraftName: '', // 마인크래프트 닉네임
  });

  // 메시지/로딩 상태
  const [message, setMessage] = useState('');      // 결과 메시지
  const [loading, setLoading] = useState(false);   // 중복 제출 방지

  /**
   * 입력값 변경 핸들러
   * - 각 input[name] 값만 부분 갱신
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /**
   * 회원가입 제출 핸들러
   * - /api/auth/register에 POST
   * - 성공: 안내 메시지, 폼 초기화
   * - 실패: 서버 메시지 출력
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    // 서버에 POST
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

  /** --- 실제 렌더링 --- */
  return (
    <div className="register-bg">
      <div className="register-container">
        <h1 className="register-title">회원가입</h1>
        <form onSubmit={handleSubmit} className="register-form">
          {/* 이메일 */}
          <div className="register-field">
            <label className="register-label">이메일</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="register-input"
            />
          </div>
          {/* 아이디 */}
          <div className="register-field">
            <label className="register-label">아이디</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className="register-input"
            />
          </div>
          {/* 비밀번호 */}
          <div className="register-field">
            <label className="register-label">비밀번호</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className="register-input"
            />
          </div>
          {/* 마인크래프트 닉네임 */}
          <div className="register-field">
            <label className="register-label">마인크래프트 닉네임</label>
            <input
              type="text"
              name="minecraftName"
              value={form.minecraftName}
              onChange={handleChange}
              required
              className="register-input"
            />
          </div>
          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="register-btn"
          >
            {loading ? '처리 중...' : '가입하기'}
          </button>
          {/* 결과 메시지 */}
          {message && <p className="register-message">{message}</p>}
        </form>
      </div>
    </div>
  );
}
