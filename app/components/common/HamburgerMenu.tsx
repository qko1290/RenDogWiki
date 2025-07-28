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

// 메뉴 props 타입 정의
interface HamburgerMenuProps {
  onClose: () => void;      // 메뉴 닫기 콜백
  isLoggedIn: boolean;      // 로그인 여부
  username?: string;        // 마크 닉네임
  uuid?: string;            // 유저 프로필용 UUID (optional)
}

/**
 * [HamburgerMenu 컴포넌트]
 * - 유저 정보(스킨, 닉네임) 및 관리 메뉴 리스트 렌더링
 * - 닫기/토글 버튼, 로그인 안내 제공
 */
export default function HamburgerMenu({
  onClose, isLoggedIn, username, uuid
}: HamburgerMenuProps) {

  // uuid 값이 없을 경우, username으로 Mojang API에서 조회
  const [resolvedUUID, setResolvedUUID] = useState<string | null>(uuid || null);

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

  // 마인크래프트 스킨 이미지 URL (없으면 기본값)
  const skinUrl = resolvedUUID
    ? `https://crafatar.com/avatars/${resolvedUUID}?overlay&size=64`
    : "https://crafatar.com/avatars/8667ba71-b85a-4004-af54-457a9734eed7?overlay&size=64";

  // 렌더링
  return (
    <div className="hamburger-menu">
      {/* 상단: 로고, 닫기버튼, 유저 정보 */}
      <div className="hamburger-menu-header">

        {/* 로고 + 닫기 버튼 */}
        <div className="hamburger-menu-top">
          <h2 className="hamburger-menu-logo">RDWIKI</h2>
          <button onClick={onClose} className="hamburger-menu-close-btn" aria-label="메뉴 닫기">×</button>
        </div>

        {/* 유저 정보(스킨, 닉네임) */}
        <div className="hamburger-user-info">
          {resolvedUUID === null && username ? (
            // 스킨 로딩 전/실패 시 플레이스홀더
            <div className="hamburger-user-placeholder" />
          ) : (
            // 스킨 이미지(정상)
            <img src={skinUrl} className="hamburger-user-image" alt="마인크래프트 프로필" />
          )}
          {/* 닉네임 없으면 기본 텍스트 */}
          <p className="hamburger-username">{username || "마인크래프트 유저"}</p>
        </div>

        {/* 로그인 안내/환영문구 */}
        <div className="hamburger-login-info">
          {isLoggedIn ? (
            username === "Q_Ko" ? (
              <span style={{ opacity: 0.85, color: '#ff8b00' }}>환영합니다 큐코님</span>
            ) : (
              <span style={{ opacity: 0.7 }}>환영합니다</span>
            )
          ) : (
            <>
              <Link href="/login">로그인</Link>
              <span className="mx-1">|</span>
              <Link href="/register">회원가입</Link>
            </>
          )}
        </div>

        {/* 구분선 */}
        <hr className="hamburger-divider" />

        {/* 관리 메뉴 리스트 */}
        <ul className="hamburger-menu-list">
          <li className="hamburger-menu-item">
            <Link href="/manage/image" className="menu-link">🖼 이미지 업로드</Link>
          </li>
          <li className="hamburger-menu-item">
            <Link href="/manage/category" className="menu-link">📂 카테고리 관리</Link>
          </li>
          <li className="hamburger-menu-item">
            <Link href="/manage/npc" className="menu-link">📂 npc 관리</Link>
          </li>
          <li className="hamburger-menu-item">
            <Link href="/manage/quest" className="menu-link">📂 퀘스트 관리</Link>
          </li>
          <li className="hamburger-menu-item">
            <Link href="/manage/head" className="menu-link">📂 머리찾기 관리</Link>
          </li>
          {/* 필요시 메뉴 추가 */}
        </ul>
      </div>

      {/* 메뉴 토글/닫기(아래쪽) */}
      <div className="hamburger-menu-toggle" onClick={onClose}>
        <span>◀</span>
      </div>
    </div>
  );
}