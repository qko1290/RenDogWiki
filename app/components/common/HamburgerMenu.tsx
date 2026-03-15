// =============================================
// File: app/components/common/HamburgerMenu.tsx
// (전체 코드)
// - 메뉴가 실제로 열렸을 때만 auth/uuid 보정 요청
// - 메뉴 내부 Link prefetch 비활성화
// - 외부 스킨 이미지는 lazy/async + width/height 명시
// =============================================
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import '@wiki/css/HamburgerMenu.css';
import logo from '../../image/logo.png';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserPlus,
  faImages,
  faList,
  faUser,
  faScroll,
  faCube,
  faCommentDots,
} from '@fortawesome/free-solid-svg-icons';
import { ModalCard } from '@/components/common/Modal';
import { toProxyUrl } from '@lib/cdn';

interface HamburgerMenuProps {
  onClose: () => void;
  isOpen: boolean;
  isLoggedIn: boolean;
  username?: string;
  uuid?: string;
  onLogout: () => void;
}

type Role = 'guest' | 'writer' | 'admin';

type AuthUser = {
  id?: number;
  username?: string;
  email?: string;
  minecraft_name?: string;
  minecraft_uuid?: string;
  role?: string | null;
};

const SPECIAL_NICKS: Record<string, string> = {
  'q_ko': '큐코',
  'rounding_': '라운딩',
  'daramg__': '다람지',
  '_kei_yuki': '케이유키',
  'minnseo': '민서',
  'wonjun125': '원준',
  'iellre': '일레',
  'carmenia434': '카르메니아',
};

function normalizeRole(v: unknown): Role {
  const s = String(v ?? '').toLowerCase();
  return s === 'admin' || s === 'writer' ? s : 'guest';
}

export default function HamburgerMenu({
  isOpen,
  onClose,
  isLoggedIn,
  username,
  uuid,
  onLogout,
}: HamburgerMenuProps) {
  const [resolvedUUID, setResolvedUUID] = useState<string | null>(uuid || null);
  const [role, setRole] = useState<Role>('guest');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);

  const [effectiveLoggedIn, setEffectiveLoggedIn] = useState(isLoggedIn);
  const [effectiveUsername, setEffectiveUsername] = useState(username || '');

  const [hoverImage, setHoverImage] = useState(false);
  const [hoverCategory, setHoverCategory] = useState(false);
  const [hoverNpc, setHoverNpc] = useState(false);
  const [hoverQuest, setHoverQuest] = useState(false);
  const [hoverHead, setHoverHead] = useState(false);

  useEffect(() => {
    setEffectiveLoggedIn(isLoggedIn);
    setEffectiveUsername(username || '');
    setResolvedUUID(uuid || null);
    setRole(isLoggedIn ? 'guest' : 'guest');
    setRoleLoaded(!isLoggedIn);
  }, [isLoggedIn, username, uuid]);

  useEffect(() => {
    if (!isOpen) return;

    let aborted = false;

    const fetchUuidByName = async (name: string) => {
      try {
        const res = await fetch(`/api/mojang/uuid?name=${encodeURIComponent(name)}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!aborted) {
          setResolvedUUID(data?.uuid ?? null);
        }
      } catch {
        if (!aborted) {
          setResolvedUUID(null);
        }
      }
    };

    (async () => {
      setRoleLoaded(false);

      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        const authUser: AuthUser | null = data?.user ?? null;
        const nextLoggedIn = Boolean(data?.loggedIn && authUser);
        const nextRole = normalizeRole(authUser?.role ?? data?.role);
        const nextUsername =
          authUser?.minecraft_name || authUser?.username || username || '';
        const nextUuid = uuid || authUser?.minecraft_uuid || null;

        if (!aborted) {
          setEffectiveLoggedIn(nextLoggedIn);
          setEffectiveUsername(nextUsername);
          setRole(nextRole);
          setRoleLoaded(true);

          if (nextUuid) {
            setResolvedUUID(nextUuid);
          }
        }

        if (!nextUuid && nextUsername) {
          await fetchUuidByName(nextUsername);
        }
      } catch {
        if (!aborted) {
          setRole('guest');
          setRoleLoaded(true);
          if (!uuid && !username) {
            setResolvedUUID(null);
          }
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [isOpen, isLoggedIn, username, uuid]);

  const normName = useMemo(
    () => (effectiveUsername ?? '').trim().toLowerCase(),
    [effectiveUsername]
  );
  const specialDisplay = SPECIAL_NICKS[normName];

  const handleGuardedClick = (e: React.MouseEvent) => {
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
      return;
    }

    onClose();
  };

  const handleNormalLinkClick = () => {
    onClose();
  };

  const skinUrl = resolvedUUID
    ? `https://crafthead.net/helm/${resolvedUUID}/64.png`
    : 'https://crafthead.net/helm/94cf9511-c5d6-433a-b565-14010caac235?overlay/64.png';

  return (
    <>
      <div
        className={`hamburger-backdrop${isOpen ? ' open' : ''}`}
        aria-hidden={!isOpen}
        onClick={onClose}
      />

      <div className={`hamburger-menu${isOpen ? ' open' : ''}`}>
        <div className="hamburger-menu-header">
          <div className="hamburger-menu-top">
            <Image src={logo} alt="" width={45} height={40} />
            <h2 className="hamburger-menu-logo">RDWIKI</h2>
            <button
              onClick={onClose}
              className="hamburger-menu-close-btn"
              aria-label="메뉴 닫기"
            >
              ×
            </button>
          </div>

          <div className="hamburger-user-card">
            <div className="hamburger-user-info">
              <Link href="/mypage" prefetch={false} onClick={handleNormalLinkClick}>
                {resolvedUUID === null && effectiveUsername ? (
                  <div className="hamburger-user-placeholder" />
                ) : (
                  <img
                    src={toProxyUrl(skinUrl)}
                    className="hamburger-user-image"
                    alt="마인크래프트 프로필"
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                )}
              </Link>
              <p className="hamburger-username">
                {effectiveLoggedIn ? effectiveUsername || 'USER' : 'GUEST'}
              </p>
            </div>

            <div className="hamburger-login-info">
              <span className="hamburger-welcome">
                {!effectiveLoggedIn ? (
                  <Link
                    href="/login"
                    prefetch={false}
                    className="hamburger-welcome no-underline"
                    onClick={handleNormalLinkClick}
                  >
                    로그인 해주세요
                  </Link>
                ) : specialDisplay ? (
                  <button onClick={onLogout} className="hamburger-welcome no-underline">
                    환영합니다 {specialDisplay}님
                  </button>
                ) : (
                  <button onClick={onLogout} className="hamburger-welcome no-underline">
                    환영합니다
                  </button>
                )}
              </span>
            </div>
          </div>

          <ul className="hamburger-menu-list">
            <li className="hamburger-menu-item">
              <div className="btn-conteiner-1">
                <Link
                  href="/manage/image"
                  prefetch={false}
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
                  prefetch={false}
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
                  prefetch={false}
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
                  prefetch={false}
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
                  prefetch={false}
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

        <div className="hm-bottom-btns">
          {effectiveLoggedIn ? (
            <>
              <Link
                href="/manage/chat"
                prefetch={false}
                className="hm-btn hm-btn-mypage"
                onClick={handleNormalLinkClick}
              >
                <div className="hm-btn-sign">
                  <FontAwesomeIcon icon={faCommentDots} />
                  <div className="hm-btn-text">&nbsp;&nbsp;&nbsp;&nbsp;채팅</div>
                </div>
              </Link>
              <button className="hm-btn hm-btn-logout" onClick={onLogout}>
                <div className="hm-btn-sign">
                  <svg viewBox="0 0 512 512">
                    <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32 32 32z"></path>
                  </svg>
                </div>
                <div className="hm-btn-text">로그아웃</div>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                prefetch={false}
                className="hm-btn hm-btn-login"
                onClick={handleNormalLinkClick}
              >
                <div className="hm-btn-sign">
                  <svg viewBox="0 0 512 512">
                    <path d="M217.9 105.9L340.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L217.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1L32 320c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM352 416l64 0c17.7 0 32-14.3 32-32l0-256c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32s-14.3-32 32-32l64 0c53 0 96 43 96 96l0 256c0 53-43 96-96 96l-64 0c-17.7 0-32-14.3-32-32s-14.3 32 32 32z"></path>
                  </svg>
                </div>
                <div className="hm-btn-text">&nbsp;&nbsp;로그인</div>
              </Link>
              <Link
                href="/register"
                prefetch={false}
                className="hm-btn hm-btn-register"
                onClick={handleNormalLinkClick}
              >
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