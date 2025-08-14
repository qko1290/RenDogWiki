// File: app/mypage/page.tsx
/**
 * 마이페이지
 * - /api/auth/me 로 로그인 사용자 정보를 로드하고 표시
 * - Mojang UUID 조회해 Crafatar 아바타 출력(없으면 닉네임 폴백)
 * - 비밀번호 변경, 계정 삭제 수행
 * - 로딩/비로그인 상태 표시, 컨텐츠 깜빡임 최소화
 */

'use client';

import WikiHeader from '@/components/common/Header';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import '@wiki/css/mypage.css';

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
  const [openPwForm, setOpenPwForm] = useState(false);
  const [openDeleteForm, setOpenDeleteForm] = useState(false);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [delPw, setDelPw] = useState('');

  // Crafatar는 UUID 권장 → 없으면 닉네임으로 폴백
  const [uuid, setUuid] = useState<string | null>(null);
  const avatarUrl = useMemo(() => {
    const base = 'https://crafatar.com/avatars';
    return `${base}/${uuid ?? user?.minecraft_name}?overlay`;
  }, [uuid, user?.minecraft_name]);

  // 유저 로딩 (언마운트 시 fetch 취소)
  const loadMe = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store', signal });
      if (!res.ok) throw 0;
      const data = await res.json();
      if (signal?.aborted) return; // 취소되면 무시
      setUser(data?.user ?? null);
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // 언마운트 취소는 조용히 무시
      setUser(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    loadMe(ac.signal);
    return () => ac.abort();
  }, []);

  // 닉네임 → UUID 조회 (언마운트 시 취소)
  useEffect(() => {
    if (!user?.minecraft_name) return;
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/mojang/uuid?name=${encodeURIComponent(user.minecraft_name)}`,
          { signal: ac.signal }
        );
        if (!r.ok) { setUuid(null); return; }
        const j = await r.json();
        if (!ac.signal.aborted) setUuid(j.uuid);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setUuid(null);
      }
    })();
    return () => ac.abort();
  }, [user?.minecraft_name]);

  // ========== handlers ==========
  const handleChangePassword = async () => {
    if (!curPw || !newPw) return alert('현재/새 비밀번호를 입력하세요.');
    if (newPw.length < 8) return alert('새 비밀번호는 8자 이상 권장합니다.');
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      const j = await res.json();
      if (!res.ok) return alert(j?.error || '비밀번호 변경 실패');

      setCurPw(''); setNewPw(''); setOpenPwForm(false);
      alert('비밀번호가 변경되었습니다.');
    } catch {
      alert('서버 오류로 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!delPw) return alert('비밀번호를 입력하세요.');
    if (!window.confirm('정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const res = await fetch('/api/auth/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: delPw }),
      });
      const j = await res.json();
      if (!res.ok) return alert(j?.error || '회원 탈퇴 실패');

      alert('탈퇴 처리되었습니다.');
      // 메인으로
      location.href = '/';
    } catch {
      alert('서버 오류로 실패했습니다.');
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
            <button
              className="mypage-btn"
              type="button"
              onClick={() => { setOpenPwForm(v => !v); setOpenDeleteForm(false); }}
            >
              비밀번호 재설정
            </button>
            {openPwForm && (
              <div className="mypage-form">
                <div className="row">
                  <label htmlFor="curPw">현재 비밀번호</label>
                  <input
                    id="curPw"
                    type="password"
                    value={curPw}
                    onChange={e => setCurPw(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="row">
                  <label htmlFor="newPw">새 비밀번호</label>
                  <input
                    id="newPw"
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => setOpenPwForm(false)}>취소</button>
                  <button className="primary" onClick={handleChangePassword}>변경</button>
                </div>
              </div>
            )}

            <button
              className="mypage-btn"
              type="button"
              onClick={() => { setOpenDeleteForm(v => !v); setOpenPwForm(false); }}
            >
              회원 탈퇴
            </button>
            {openDeleteForm && (
              <div className="mypage-form">
                <div className="row">
                  <label htmlFor="delPw">비밀번호 확인</label>
                  <input
                    id="delPw"
                    type="password"
                    value={delPw}
                    onChange={e => setDelPw(e.target.value)}
                    autoComplete="current-password"
                  />
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
    </div>
  );
}
