// =============================================
// File: components/common/HamburgerMenu.tsx
// =============================================
import React, { useEffect, useMemo, useState } from "react";
import Link from 'next/link';
import '@wiki/css/HamburgerMenu.css';
import logo from '../../image/logo.png';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { ModalCard } from '@/components/common/Modal';

interface HamburgerMenuProps {
  onClose: () => void;
  isOpen: boolean;

  /** 아래 두 값은 선택(props 없더라도 자동으로 /api/auth/me로 보정) */
  isLoggedIn?: boolean;
  username?: string;
  uuid?: string;

  onLogout?: () => void;
}

type Role = 'guest' | 'writer' | 'admin';

const SPECIAL_NICKS: Record<string, string> = {
  'q_ko': '큐코',
  'rounding_': '라운딩',
  'daramg__': '다람지'
};

export default function HamburgerMenu({
  isOpen, onClose, isLoggedIn: isLoggedInProp, username: usernameProp, uuid: uuidProp,
  onLogout,
}: HamburgerMenuProps) {

  /** ---- 상태: 서버로부터 확정한 로그인/유저 정보 ---- */
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!isLoggedInProp);
  const [username, setUsername] = useState<string | undefined>(usernameProp);
  const [resolvedUUID, setResolvedUUID] = useState<string | null>(uuidProp ?? null);
  const [role, setRole] = useState<Role>('guest');
  const [roleLoaded, setRoleLoaded] = useState(false);

  const [denyOpen, setDenyOpen] = useState(false);

  /** 메뉴가 열릴 때마다 실제 세션으로 정정 */
  useEffect(() => {
    if (!isOpen) return;
    let aborted = false;
    setRoleLoaded(false);

    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) {
          if (!aborted) {
            setIsLoggedIn(false);
            setRole('guest');
            setRoleLoaded(true);
          }
          return;
        }
        const data = await res.json();
        const u = data?.user;

        if (!aborted) {
          setIsLoggedIn(true);
          setUsername(u?.minecraft_name || u?.username || usernameProp);
          const rawRole = String(u?.role ?? data?.role ?? 'guest').toLowerCase();
          setRole(rawRole === 'admin' || rawRole === 'writer' ? (rawRole as Role) : 'guest');
          setRoleLoaded(true);

          // UUID 우선순위: props.uuid > API(uuid) > API(minecraft_name 조회)
          if (uuidProp) {
            setResolvedUUID(uuidProp);
          } else if (u?.minecraft_uuid) {
            setResolvedUUID(u.minecraft_uuid);
          } else if (u?.minecraft_name) {
            try {
              const r2 = await fetch(`/api/mojang/uuid?name=${encodeURIComponent(u.minecraft_name)}`);
              const j2 = await r2.json().catch(() => ({}));
              setResolvedUUID(j2?.uuid ?? null);
            } catch { setResolvedUUID(null); }
          } else {
            setResolvedUUID(null);
          }
        }
      } catch {
        if (!aborted) {
          setIsLoggedIn(false);
          setRole('guest');
          setRoleLoaded(true);
          setResolvedUUID(null);
        }
      }
    })();

    return () => { aborted = true; };
  // props가 달라져도 다시 정합성 맞추도록 의존성 포함
  }, [isOpen, uuidProp, usernameProp, isLoggedInProp]);

  const normName = (username ?? '').trim().toLowerCase();
  const specialDisplay = SPECIAL_NICKS[normName];

  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) window.location.href = '/wiki';
      else alert('로그아웃 실패');
    } catch { alert('로그아웃 요청 오류'); }
  }

  // writer 이상 필요한 메뉴 클릭 가드
  const handleGuardedClick = (e: React.MouseEvent) => {
    // 아직 로딩 전이면 우선 막고 안내
    if (!roleLoaded) {
      e.preventDefault();
      e.stopPropagation();
      setDenyOpen(true);
      return;
    }
    const allowed = role === 'writer' || role === 'admin';
    if (!allowed) {
      e.preventDefault();
      e.stopPropagation();
      setDenyOpen(true);
    }
  };

  const skinUrl = useMemo(() => {
    const fallback = "https://crafatar.com/avatars/94cf9511-c5d6-433a-b565-14010caac235?overlay&size=64";
    if (resolvedUUID) return `https://crafatar.com/avatars/${resolvedUUID}?overlay&size=64`;
    if (username) return `https://crafatar.com/avatars/${encodeURIComponent(username)}?overlay&size=64`;
    return fallback;
  }, [resolvedUUID, username]);

  return (
    <>
      {/* Backdrop */}
      <div className={`hamburger-backdrop${isOpen ? ' open' : ''}`} aria-hidden={!isOpen} onClick={onClose} />

      <div className={`hamburger-menu${isOpen ? ' open' : ''}`}>
        {/* 헤더 */}
        <div className="hamburger-menu-header">
          <div className="hamburger-menu-top">
            <Image src={logo} alt="" width={45} height={40} />
            <h2 className="hamburger-menu-logo">RDWIKI</h2>
            <button onClick={onClose} className="hamburger-menu-close-btn" aria-label="메뉴 닫기">×</button>
          </div>

          {/* 유저 카드 */}
          <div className="hamburger-user-card">
            <div className="hamburger-user-info">
              <img src={skinUrl} className="hamburger-user-image" alt="마인크래프트 프로필" />
              <p className="hamburger-username">{isLoggedIn ? (username || 'USER') : 'GUEST'}</p>
            </div>
            <div className="hamburger-login-info">
              <span className="hamburger-welcome">
                {!isLoggedIn
                  ? <Link href="/login" className="hamburger-welcome no-underline">로그인 해주세요</Link>
                  : specialDisplay ? `환영합니다 ${specialDisplay}님` : '환영합니다'}
              </span>
            </div>
          </div>

          {/* 메뉴 리스트 */}
          <ul className="hamburger-menu-list">
            <li className="hamburger-menu-item">
              <div className="btn-conteiner-1">
                <Link href="/manage/image" className="btn-content" onClick={handleGuardedClick}>
                  <span className="btn-title">IMAGE</span>
                  <span className="icon-arrow">{/* svg 생략(기존 그대로) */}</span>
                </Link>
              </div>
            </li>

            <li className="hamburger-menu-item">
              <div className="btn-conteiner-2">
                <Link href="/manage/category" className="btn-content" onClick={handleGuardedClick}>
                  <span className="btn-title">Category</span>
                  <span className="icon-arrow" />
                </Link>
              </div>
            </li>

            <li className="hamburger-menu-item">
              <div className="btn-conteiner-3">
                <Link href="/manage/npc" className="btn-content" onClick={handleGuardedClick}>
                  <span className="btn-title">NPC</span>
                  <span className="icon-arrow" />
                </Link>
              </div>
            </li>

            <li className="hamburger-menu-item">
              <div className="btn-conteiner-4">
                <Link href="/manage/quest" className="btn-content" onClick={handleGuardedClick}>
                  <span className="btn-title">QUEST</span>
                  <span className="icon-arrow" />
                </Link>
              </div>
            </li>

            <li className="hamburger-menu-item">
              <div className="btn-conteiner-5">
                <Link href="/manage/head" className="btn-content" onClick={handleGuardedClick}>
                  <span className="btn-title">HEAD</span>
                  <span className="icon-arrow" />
                </Link>
              </div>
            </li>
          </ul>
        </div>

        {/* 하단 버튼 */}
        <div className="hm-bottom-btns">
          {isLoggedIn ? (
            <>
              <Link href="/mypage" className="hm-btn hm-btn-mypage">
                <div className="hm-btn-sign">{/* icon */}</div>
                <div className="hm-btn-text">&nbsp;&nbsp;프로필</div>
              </Link>
              <button className="hm-btn hm-btn-logout" onClick={onLogout ?? handleLogout}>
                <div className="hm-btn-sign">{/* icon */}</div>
                <div className="hm-btn-text">로그아웃</div>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hm-btn hm-btn-login">
                <div className="hm-btn-sign">{/* icon */}</div>
                <div className="hm-btn-text">&nbsp;&nbsp;로그인</div>
              </Link>
              <Link href="/register" className="hm-btn hm-btn-register">
                <div className="hm-btn-sign"><FontAwesomeIcon icon={faUserPlus} /></div>
                <div className="hm-btn-text">&nbsp;회원가입</div>
              </Link>
            </>
          )}
        </div>
      </div>

      <ModalCard
        open={denyOpen}
        onClose={() => setDenyOpen(false)}
        title="경고"
        actions={<button className="rd-btn danger" onClick={() => setDenyOpen(false)}>확인</button>}
        width={360}
      >
        <p className="rd-card-description" style={{ textAlign: 'center', whiteSpace: 'pre-line' }}>
          권한이 없습니다{'\n'}관리자에게 문의해주세요
        </p>
      </ModalCard>
    </>
  );
}
