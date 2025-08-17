// =============================================
// File: app/register/page.tsx
// =============================================
/**
 * 회원가입
 * - 한글 입력 제거(stripHangul) 유지
 * - 공통 apiFetch/토스트 사용 + 성공 시 지연 리다이렉트
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import WikiHeader from '@/components/common/Header';
import '@wiki/css/login.css';
import '@wiki/css/register.css';
import { useRouter } from 'next/navigation';
import { apiFetch, toast } from '@/wiki/lib/fetcher';

type FormState = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  minecraftName: string;
};

type FieldErrors = Partial<Record<'email'|'username'|'minecraftName'|'password'|'confirmPassword', string>>;

/* ===== 한글 차단 유틸 ===== */
const HANGUL_GLOBAL = /[\uAC00-\uD7A3\u1100-\u11FF\u3131-\u318E]/g;
const stripHangul = (s: string) => s.replace(HANGUL_GLOBAL, '');
/* ======================== */

export default function RegisterPage() {
  const router = useRouter();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<FormState>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    minecraftName: '',
  });

  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  // ✅ 한글 입력을 즉시 제거
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let v = value;

    // 모든 주요 필드에 한글 차단 적용
    if (
      name === 'email' ||
      name === 'username' ||
      name === 'password' ||
      name === 'confirmPassword' ||
      name === 'minecraftName'
    ) {
      v = stripHangul(v);
    }

    setForm(prev => ({ ...prev, [name]: v }));
    setErrors(prev => ({ ...prev, [name]: undefined })); // 입력 시 해당 에러 클리어
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setErrors({});

    // 비밀번호 재입력 검증
    if (form.password !== form.confirmPassword) {
      setErrors({ confirmPassword: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: {
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
          minecraftName: form.minecraftName.trim(),
        },
      });

      // 성공
      setMessage('회원가입 성공! 이메일을 확인해주세요.\n잠시후 로그인 페이지로 이동합니다.');
      toast.success('회원가입 성공! 이메일을 확인해주세요.');
      redirectTimerRef.current = setTimeout(() => { router.push('/login'); }, 1800);
      setForm({ email: '', username: '', password: '', confirmPassword: '', minecraftName: '' });

    } catch (e: any) {
      // 409 필드 중복 처리
      if (e?.status === 409 && e?.data?.fields) {
        const fe: FieldErrors = {};
        if (e.data.fields.email) fe.email = '이미 사용 중인 이메일입니다.';
        if (e.data.fields.username) fe.username = '이미 사용 중인 아이디입니다.';
        if (e.data.fields.minecraftName) fe.minecraftName = '이미 사용 중인 닉네임입니다.';
        setErrors(fe);
        setMessage('중복된 항목이 있습니다. 빨간 메시지를 확인하세요.');
        return;
      }
      // apiFetch가 에러 토스트 처리하므로 여기서는 보조 메시지만
      setMessage(e?.message || '회원가입 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  return (
    <div className="login-page-root">
      <WikiHeader user={null} />
      <main className="login-bg">
        <div id="form-ui">
          <form id="form" onSubmit={handleSubmit} autoComplete="on" noValidate>
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
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder=" "
                    spellCheck={false}
                    aria-invalid={!!errors.email}
                  />
                  <label htmlFor="email" className="login-label">이메일</label>
                  <span className="login-underline"></span>
                  {errors.email && <p className="input-error">{errors.email}</p>}
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
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder=" "
                    spellCheck={false}
                    aria-invalid={!!errors.username}
                  />
                  <label htmlFor="username" className="login-label">아이디</label>
                  <span className="login-underline"></span>
                  {errors.username && <p className="input-error">{errors.username}</p>}
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
                    aria-invalid={!!errors.password}
                  />
                  <label htmlFor="password" className="login-label">비밀번호</label>
                  <span className="login-underline"></span>
                  {errors.password && <p className="input-error">{errors.password}</p>}
                </div>

                {/* 비밀번호 재입력 */}
                <div className="login-input-group">
                  <input
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    required
                    className="login-input"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder=" "
                    spellCheck={false}
                    aria-invalid={!!errors.confirmPassword}
                  />
                  <label htmlFor="confirmPassword" className="login-label">비밀번호 확인</label>
                  <span className="login-underline"></span>
                  {errors.confirmPassword && <p className="input-error">{errors.confirmPassword}</p>}
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
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder=" "
                    spellCheck={false}
                    aria-invalid={!!errors.minecraftName}
                  />
                  <label htmlFor="minecraftName" className="login-label">마인크래프트 닉네임</label>
                  <span className="login-underline"></span>
                  {errors.minecraftName && <p className="input-error">{errors.minecraftName}</p>}
                </div>
              </div>

              <div id="submit-button-cvr">
                <button id="submit-button" type="submit" disabled={loading}>
                  {loading ? '처리 중...' : '가입하기'}
                </button>
              </div>

              {message && <p className="login-message" aria-live="polite">{message}</p>}
            </div>
          </form>
        </div>
      </main>

      {/* 메시지 줄바꿈 보장 및 에러 스타일 */}
      <style jsx global>{`
        .login-message { white-space: pre-line; }
        .input-error {
          margin-top: 6px;
          font-size: 12px;
          color: #e11d48; /* rose-600 */
          font-weight: 600;
        }
        [aria-invalid="true"] ~ .login-underline {
          background: #fecaca;
        }
      `}</style>
    </div>
  );
}
