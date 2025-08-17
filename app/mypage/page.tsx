// =============================================
// File: app/mypage/page.tsx
// =============================================
/**
 * 마이페이지
 * - 내 정보 조회/비번변경/탈퇴
 * - Crafatar 아바타 표시(닉→UUID 조회)
 * - 공통 apiFetch/토스트/confirm 사용
 */
'use client';

import WikiHeader from '@/components/common/Header';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import '@wiki/css/mypage.css';
import { apiFetch, confirmDialog, toast } from '@/wiki/lib/fetcher';

type UserInfo = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
  role?: string;
};

export default function MyPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // 폼 토글/상태
  const [openNickForm, setOpenNickForm] = useState(false);
  const [openPwForm, setOpenPwForm] = useState(false);
  const [openDeleteForm, setOpenDeleteForm] = useState(false);

  const [newNick, setNewNick] = useState('');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [delPw, setDelPw] = useState('');

  // Crafatar는 UUID 권장 → 없으면 닉네임으로 폴백
  const [uuid, setUuid] = useState<string | null>(null);
  const avatarUrl = useMemo(() => {
    const base = 'https://crafatar.com/avatars';
    return `${base}/${uuid ?? user?.minecraft_name}?overlay`;
  }, [uuid, user?.minecraft_name]);

  // 유저 로딩
  const loadMe = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ user: UserInfo | null }>('/api/auth/me');
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMe(); }, []);

  // 닉네임 → UUID 조회
  useEffect(() => {
    (async () => {
      if (!user?.minecraft_name) return;
      try {
        const j = await apiFetch<{ uuid: string | null }>(
          `/api/mojang/uuid?name=${encodeURIComponent(user.minecraft_name)}`,
          { suppressErrorToast: true } // 실패해도 폴백
        );
        setUuid(j?.uuid ?? null);
      } catch {
        setUuid(null);
      }
    })();
  }, [user?.minecraft_name]);

  // ========== handlers ==========
  const handleChangeNick = async () => {
    if (!newNick.trim()) return toast.error('새 닉네임을 입력하세요.');
    try {
      await apiFetch('/api/profile/minecraft-name', {
        method: 'PATCH',
        body: { newName: newNick.trim() },
      });
      await loadMe(); // 서버가 새 JWT도 재발급
      setNewNick('');
      setOpenNickForm(false);
      toast.success('닉네임이 변경되었습니다.');
    } catch (e) {
      // apiFetch가 에러 토스트 처리
    }
  };

  const handleChangePassword = async () => {
    if (!curPw || !newPw) return toast.error('현재/새 비밀번호를 입력하세요.');
    if (newPw.length < 8) return toast.error('새 비밀번호는 8자 이상 권장합니다.');
    try {
      await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: { currentPassword: curPw, newPassword: newPw },
      });
      setCurPw(''); setNewPw(''); setOpenPwForm(false);
      toast.success('비밀번호가 변경되었습니다.');
    } catch {
      /* handled */
    }
  };

  const handleDelete = async () => {
    if (!delPw) return toast.error('비밀번호를 입력하세요.');
    const ok = await confirmDialog('정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
    if (!ok) return;
    try {
      await apiFetch('/api/auth/me', { method: 'DELETE', body: { password: delPw } });
      toast.success('탈퇴 처리되었습니다.');
      location.href = '/';
    } catch {
      /* handled */
    }
  };

  // ========== render ==========
  if (loading) {
    return (
      <div className="login-page-root">
        <WikiHeader user={null} />
        <main className="login-bg"><div>로딩 중...</div></main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-page-root">
        <WikiHeader user={null} />
        <main className="login-bg"><div>로그인이 필요합니다.</div></main>
      </div>
    );
  }

  return (
    <div className="login-page-root">
      <WikiHeader user={user} />
      <main className="login-bg">
        <section className="mypage-ui">
          <h2 className="mypage-title">마이페이지</h2>

          {/* 프로필 */}
          <div className="mypage-profile-box">
            <div className="mypage-avatar">
              <img src={avatarUrl} alt="마인크래프트 스킨" />
            </div>
            <div className="mypage-profile-info">
              <div className="mypage-profile-field">
                <span className="label">닉네임</span>
                <span>{user.minecraft_name}</span>
              </div>
              <div className="mypage-profile-field">
                <span className="label">이메일</span>
                <span>{user.email}</span>
              </div>
              <div className="mypage-profile-field">
                <span className="label">권한</span>
                <span>{user.role || '없음'}</span>
              </div>
            </div>
          </div>
          <div className="mypage-btn-row">
            <button className="mypage-btn" type="button"
              onClick={() => { setOpenPwForm(v => !v); setOpenNickForm(false); setOpenDeleteForm(false); }}>
              비밀번호 재설정
            </button>
            {openPwForm && (
              <div className="mypage-form">
                <div className="row">
                  <label htmlFor="curPw">현재 비밀번호</label>
                  <input id="curPw" type="password" value={curPw} onChange={e => setCurPw(e.target.value)} />
                </div>
                <div className="row">
                  <label htmlFor="newPw">새 비밀번호</label>
                  <input id="newPw" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => setOpenPwForm(false)}>취소</button>
                  <button className="primary" onClick={handleChangePassword}>변경</button>
                </div>
              </div>
            )}

            <button className="mypage-btn" type="button"
              onClick={() => { setOpenDeleteForm(v => !v); setOpenNickForm(false); setOpenPwForm(false); }}>
              회원 탈퇴
            </button>
            {openDeleteForm && (
              <div className="mypage-form">
                <div className="row">
                  <label htmlFor="delPw">비밀번호 확인</label>
                  <input id="delPw" type="password" value={delPw} onChange={e => setDelPw(e.target.value)} />
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => setOpenDeleteForm(false)}>취소</button>
                  <button className="primary" onClick={handleDelete}>탈퇴</button>
                </div>
              </div>
            )}
          </div>

          {/* 내가 쓴 문서 */}
          <div className="mypage-doc-link-row">
            <Link href="/wiki" className="mypage-doc-btn">
              내가 쓴 문서 전체보기
            </Link>
          </div>
        </section>
      </main>

      {/* 메시지 줄바꿈 보장 및 에러 스타일 */}
      <style jsx global>{`
        .login-message { white-space: pre-line; }
        .input-error {
          margin-top: 6px;
          font-size: 12px;
          color: #e11d48;
          font-weight: 600;
        }
        [aria-invalid="true"] ~ .login-underline { background: #fecaca; }
      `}</style>
    </div>
  );
}
