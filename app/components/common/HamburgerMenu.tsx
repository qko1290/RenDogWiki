// File: components/common/HamburgerMenu.tsx

/**
 * 우측 사이드에서 햄버거 메뉴
 * - 로그인 상태/유저 정보(스킨, 닉네임, UUID) 표시
 * - 관리/탐색/유틸 메뉴 진입점
 * - 카테고리 관리, 문서 생성 등 관리자 메뉴뉴
 */

import React from "react";
import Link from 'next/link';

import { useEffect, useState } from "react";
import '@wiki/css/HamburgerMenu.css';

// 타입 및 Props 선언
interface HamburgerMenuProps {
  onClose: () => void;      // 메뉴 닫기 콜백
  isLoggedIn: boolean;      // 로그인 여부
  username?: string;        // 마크 닉네임
  uuid?: string;            // 스킨 렌더링용 UUID
}

// 메인 컴포넌트
export default function HamburgerMenu({
  onClose, isLoggedIn, username, uuid
}: HamburgerMenuProps) {

  const [resolvedUUID, setResolvedUUID] = useState<string | null>(uuid || null);

  useEffect(() => {
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

  // 유저 스킨 이미지 URL(디폴트: 스티브)
  const skinUrl = resolvedUUID
    ? `https://crafatar.com/avatars/${resolvedUUID}?overlay&size=64`
    : "https://crafatar.com/avatars/8667ba71-b85a-4004-af54-457a9734eed7?overlay&size=64";

  return (
    <div className="hamburger-menu">
      {/* 상단: 로고, 닫기버튼, 유저 정보 */}
      <div className="hamburger-menu-header">
        {/* 헤더 (로고+닫기) */}
        <div className="hamburger-menu-top">
          <h2 className="hamburger-menu-logo">RDWIKI</h2>
          <button onClick={onClose} className="hamburger-menu-close-btn" aria-label="메뉴 닫기">×</button>
      </div>

        {/* 유저 정보(스킨+닉네임) */}
        <div className="hamburger-user-info">
          {resolvedUUID === null && username ? (
            <div className="hamburger-user-placeholder" />
          ) : (
             <img src={skinUrl} className="hamburger-user-image" alt="마인크래프트 프로필" />
          )}
          <p className="hamburger-username">{username || "마인크래프트 유저"}</p>
        </div>

        {/* 로그인 안내/환영문구 */}
        <div className="hamburger-login-info">
          {isLoggedIn ? (
            <span style={{ opacity: 0.7 }}>환영합니다</span>
          ) : (
            <>
              <Link href="/login">로그인</Link>
              <span className="mx-1">|</span>
              <Link href="/register">회원가입</Link>
            </>
          )}
        </div>

        {/* 관리 메뉴 구분선 */}
        <hr className="hamburger-divider" />

        {/* 메인 메뉴 목록 */}
        <ul className="hamburger-menu-list">
          <li className="hamburger-menu-item">
            <Link href="/manage/image" className="menu-link">🖼 이미지 업로드</Link>
          </li>
          <li className="hamburger-menu-item">
            <Link href="/manage/category" className="menu-link">📂 카테고리 관리</Link>
          </li>
        </ul>
      </div>

      {/* 닫기 버튼*/}
       <div className="hamburger-menu-toggle" onClick={onClose}>
        <span>◀</span>
      </div>
    </div>
  );
}
