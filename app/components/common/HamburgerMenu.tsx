// =============================================
// File: components/common/HamburgerMenu.tsx
// =============================================
/**
 * 우측 사이드 햄버거 메뉴 컴포넌트
 * - 로그인 상태, 유저 정보(마크 스킨, 닉네임, UUID) 표시
 * - 이미지 업로드, 카테고리/퀘스트/NPC/머리찾기 관리 등 관리 메뉴 진입
 * - 닫기, 메뉴 토글 등 UI 제공
 */

import React, { useEffect, useState } from "react";
import Link from 'next/link';
import '@wiki/css/HamburgerMenu.css';
import logo from '../../image/logo.png';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUserPlus, faImages, faList, faUser, faScroll, faCube, faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { ModalCard } from '@/components/common/Modal';

// 메뉴 props 타입 정의
interface HamburgerMenuProps {
  onClose: () => void;      // 메뉴 닫기 콜백
  isOpen: boolean;
  isLoggedIn: boolean;      // 로그인 여부
  username?: string;        // 마크 닉네임
  uuid?: string;            // 유저 프로필용 UUID (optional)
  onLogout: () => void;
}

type Role = 'guest' | 'writer' | 'admin';

const SPECIAL_NICKS: Record<string, string> = {
  'q_ko': '큐코',
  'rounding_': '라운딩',
  'daramg__': '다람지',
  '_Kei_Yuki': '케이유키',
  'MINnSEO': '민서',
  'Wonjun125': '원준',
  'Iellre': '일레'
};

/**
 * [HamburgerMenu 컴포넌트]
 * - 유저 정보(스킨, 닉네임) 및 관리 메뉴 리스트 렌더링
 * - 닫기/토글 버튼, 로그인 안내 제공
 */
export default function HamburgerMenu({
  isOpen, onClose, isLoggedIn, username, uuid
}: HamburgerMenuProps) {

  // uuid 값이 없을 경우, username으로 Mojang API에서 조회
  const [resolvedUUID, setResolvedUUID] = useState<string | null>(uuid || null);
  const [role, setRole] = useState<Role>('guest');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);

  const [effectiveLoggedIn, setEffectiveLoggedIn] = useState(isLoggedIn);
  const [effectiveUsername, setEffectiveUsername] = useState(username);

  const [hoverImage, setHoverImage] = useState(false);
  const [hoverCategory, setHoverCategory] = useState(false);
  const [hoverNpc, setHoverNpc] = useState(false);
  const [hoverQuest, setHoverQuest] = useState(false);
  const [hoverHead, setHoverHead] = useState(false);

  const normName = (effectiveUsername ?? '').trim().toLowerCase();
  const specialDisplay = SPECIAL_NICKS[normName];
  
  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        // 로그인 상태를 false로 바꿔주거나, 새로고침/이동
        window.location.href = '/wiki'; // 필요 시 메인 페이지로 이동
      } else {
        alert('로그아웃 실패');
      }
    } catch {
      alert('로그아웃 요청 오류');
    }
  }

  useEffect(() => {
    // uuid 미전달 + username 있을 때만 Mojang API 호출
    if (username && !uuid) {
      fetch(`/api/mojang/uuid?name=${username}`)
        .then(res => res.json())
        .then(data => {
          if (data.uuid) setResolvedUUID(data.uuid);
          else throw new Error();
        })
        .catch(() => {
          setResolvedUUID(null);
        });
    }
  }, [username, uuid]);

  // 로그인 시 /api/me에서 role 조회(없으면 guest로 처리)
  useEffect(() => {
    if (!effectiveLoggedIn) {
      setRole('guest');
      setRoleLoaded(true);
      return;
    }
    let aborted = false;
    setRoleLoaded(false);
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) { if (!aborted) { setRole('guest'); setRoleLoaded(true); } return; }
        const data = await res.json();
        const raw = (data?.user?.role ?? data?.role ?? 'guest');
        const normalized = typeof raw === 'string' ? raw.toLowerCase() : 'guest';
        const finalRole: Role = normalized === 'admin' || normalized === 'writer' ? (normalized as Role) : 'guest';
        if (!aborted) { setRole(finalRole); setRoleLoaded(true); }
      } catch { if (!aborted) { setRole('guest'); setRoleLoaded(true); } }
    })();
    return () => { aborted = true; };
  }, [effectiveLoggedIn]);

  useEffect(() => {
    setEffectiveLoggedIn(isLoggedIn);
    setEffectiveUsername(username);
  }, [isLoggedIn, username]);

  useEffect(() => {
    if (!isOpen || isLoggedIn) return; // 상위에서 이미 true면 보정 불필요
    let aborted = false;

    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const u = j?.user;
        if (!u || aborted) return;

        // 로그인/닉네임 보정
        setEffectiveLoggedIn(true);
        setEffectiveUsername(u.minecraft_name || u.username || effectiveUsername);

        // role 보정
        const raw = (u.role ?? j.role ?? 'guest');
        const normalized = String(raw).toLowerCase();
        setRole(normalized === 'admin' || normalized === 'writer' ? (normalized as Role) : 'guest');
        setRoleLoaded(true);

        // uuid 보정 (props.uuid 없을 때만)
        if (!uuid) {
          if (u.minecraft_uuid) {
            setResolvedUUID(u.minecraft_uuid);
          } else if (u.minecraft_name) {
            try {
              const r2 = await fetch(`/api/mojang/uuid?name=${encodeURIComponent(u.minecraft_name)}`);
              const j2 = await r2.json().catch(() => ({}));
              if (!aborted) setResolvedUUID(j2?.uuid ?? null);
            } catch {
              if (!aborted) setResolvedUUID(null);
            }
          }
        }
      } catch {}
    })();

    return () => { aborted = true; };
  }, [isOpen, isLoggedIn, uuid, effectiveUsername]);

  // writer 이상 필요한 메뉴 클릭 가드
  const handleGuardedClick = (e: React.MouseEvent) => {
    // 로딩 전이면 우선 막고 안내
    if (!roleLoaded) {
      e.preventDefault();
      e.stopPropagation();
      setDenyOpen(true);
      return;
    }
    // 권한만으로 결정: writer 또는 admin이면 통과
    const allowed = role === 'writer' || role === 'admin';
    if (!allowed) {
      e.preventDefault();
      e.stopPropagation();
      setDenyOpen(true);
    }
  };

  // 마인크래프트 스킨 이미지 URL (없으면 기본값)
  const skinUrl = resolvedUUID
    ? `https://crafthead.net/helm/${resolvedUUID}/64.png`
    : "https://crafthead.net/helm/94cf9511-c5d6-433a-b565-14010caac235?overlay/64.png";

  // 렌더링
  return (
  <>
    {/* ✅ 백그라운드 흐림/딤 오버레이 */}
    <div
      className={`hamburger-backdrop${isOpen ? ' open' : ''}`}
      aria-hidden={!isOpen}
      onClick={onClose}
    />
    <div className={`hamburger-menu${isOpen ? ' open' : ''}`}>
      {/* 상단: 로고, 닫기버튼, 유저 정보 */}
      <div className="hamburger-menu-header">

        {/* 로고 + 닫기 버튼 */}
        <div className="hamburger-menu-top">
          <Image src={logo} alt={""} width={45} height={40} />
          <h2 className="hamburger-menu-logo">RDWIKI</h2>
          <button onClick={onClose} className="hamburger-menu-close-btn" aria-label="메뉴 닫기">×</button>
        </div>

        {/* 네온 카드로 감싼 유저 정보+로그인 안내 */}
        <div className="hamburger-user-card">
          <div className="hamburger-user-info">
            <Link href="/mypage">
              {resolvedUUID === null && username ? (
                <div className="hamburger-user-placeholder" />
              ) : (
                <img
                  src={skinUrl}
                  className="hamburger-user-image"
                  alt="마인크래프트 프로필"
                />
              )}
            </Link>
            <p className="hamburger-username">
              {effectiveLoggedIn ? (effectiveUsername || 'USER') : 'GUEST'}
            </p>
          </div>
          <div className="hamburger-login-info">
            <span className="hamburger-welcome">
              {!isLoggedIn
                ? <Link href="/login" className="hamburger-welcome no-underline">로그인 해주세요</Link> 
                : specialDisplay
                  ? <button onClick={handleLogout} className="hamburger-welcome no-underline">환영합니다 {specialDisplay}님</button>
                  : <button onClick={handleLogout} className="hamburger-welcome no-underline">환영합니다</button>}
            </span>
          </div>
        </div>

        {/* 관리 메뉴 리스트 */}
        <ul className="hamburger-menu-list">
          <li className="hamburger-menu-item">
            <div className="btn-conteiner-1">
              <Link
                href="/manage/image"
                className="glow-btn"
                onClick={handleGuardedClick}
                onMouseEnter={() => setHoverImage(true)}
                onMouseLeave={() => setHoverImage(false)}
              >
                {hoverImage ? <FontAwesomeIcon icon={faImages} /> : 'IMAGE'}
              </Link>
            </div>
          </li>

          <li className="hamburger-menu-item">
            <div className="btn-conteiner-2">
              <Link
                href="/manage/category"
                className="glow-btn"
                onClick={handleGuardedClick}
                onMouseEnter={() => setHoverCategory(true)}
                onMouseLeave={() => setHoverCategory(false)}
              >
                {hoverCategory ? <FontAwesomeIcon icon={faList} /> : 'CATEGORY'}
              </Link>
            </div>
          </li>

          <li className="hamburger-menu-item">
            <div className="btn-conteiner-3">
              <Link
                href="/manage/npc"
                className="glow-btn"
                onClick={handleGuardedClick}
                onMouseEnter={() => setHoverNpc(true)}
                onMouseLeave={() => setHoverNpc(false)}
              >
                {hoverNpc ? <FontAwesomeIcon icon={faUser} /> : 'NPC'}
              </Link>
            </div>
          </li>

          <li className="hamburger-menu-item">
            <div className="btn-conteiner-4">
              <Link
                href="/manage/quest"
                className="glow-btn"
                onClick={handleGuardedClick}
                onMouseEnter={() => setHoverQuest(true)}
                onMouseLeave={() => setHoverQuest(false)}
              >
                {hoverQuest ? <FontAwesomeIcon icon={faScroll} /> : 'QUEST'}
              </Link>
            </div>
          </li>

          <li className="hamburger-menu-item">
            <div className="btn-conteiner-5">
              <Link
                href="/manage/head"
                className="glow-btn"
                onClick={handleGuardedClick}
                onMouseEnter={() => setHoverHead(true)}
                onMouseLeave={() => setHoverHead(false)}
              >
                {hoverHead ? <FontAwesomeIcon icon={faCube} /> : 'HEAD'}
              </Link>
            </div>
          </li>
        </ul>
      </div>

      {/* === 하단 로그인/회원 버튼 영역 === */}
      <div className="hm-bottom-btns">
        {effectiveLoggedIn ? (
          <>
            <Link href="/manage/chat" className="hm-btn hm-btn-mypage">
              <div className="hm-btn-sign">
                <FontAwesomeIcon icon={faCommentDots} />
                <div className="hm-btn-text">&nbsp;&nbsp;&nbsp;&nbsp;채팅</div>
              </div>
            </Link>
            <button className="hm-btn hm-btn-logout" onClick={handleLogout}>
              <div className="hm-btn-sign"><svg viewBox="0 0 512 512"><path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32 32 32z"></path></svg></div>
              <div className="hm-btn-text">로그아웃</div>
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="hm-btn hm-btn-login">
              <div className="hm-btn-sign">
                <svg viewBox="0 0 512 512"><path d="M217.9 105.9L340.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L217.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1L32 320c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM352 416l64 0c17.7 0 32-14.3 32-32l0-256c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32s-14.3-32 32-32l64 0c53 0 96 43 96 96l0 256c0 53-43 96-96 96l-64 0c-17.7 0-32-14.3-32-32s-14.3 32 32 32z"></path></svg>
              </div>
              <div className="hm-btn-text">&nbsp;&nbsp;로그인</div>
            </Link>
            <Link href="/register" className="hm-btn hm-btn-register">
              <div className="hm-btn-sign">
                <FontAwesomeIcon icon={faUserPlus} />
              </div>
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
      actions={
        <button className="rd-btn danger" onClick={() => setDenyOpen(false)}>
          확인
        </button>
      }
      width={360}
    >
      <p className="rd-card-description" style={{ textAlign: 'center', whiteSpace: 'pre-line' }}>
        권한이 없습니다{'\n'}관리자에게 문의해주세요
      </p>
    </ModalCard>
    </>
  );
}
