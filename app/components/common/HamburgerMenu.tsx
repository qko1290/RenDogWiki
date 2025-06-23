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
    <div className="fixed top-0 right-0 w-64 h-full bg-zinc-900 text-white flex flex-col justify-between border-l border-white z-50 shadow-lg">
      {/* 상단: 로고, 닫기버튼, 유저 정보 */}
      <div className="p-4">
        {/* 헤더 (로고+닫기) */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-xl">RDWIKI</h2>
          <button onClick={onClose} className="text-2xl" aria-label="메뉴 닫기">×</button>
        </div>

        {/* 유저 정보(스킨+닉네임) */}
        <div className="flex flex-col items-center gap-1 mb-3">
          {resolvedUUID === null && username ? (
            <div className="w-16 h-16 rounded-md bg-zinc-800 animate-pulse" />
          ) : (
            <img
              src={`https://crafatar.com/avatars/${resolvedUUID}?overlay&size=64`}
              className="rounded-md w-16 h-16"
              alt="마인크래프트 프로필"
            />
          )}
          <p className="text-sm text-cyan-400">
            {username || "마인크래프트 유저"}
          </p>
        </div>

        {/* 로그인 안내/환영문구 */}
        <div className="text-center text-sm mb-2">
          {isLoggedIn ? (
            <span className="text-white/70">환영합니다</span>
          ) : (
            <>
              <Link href="/login" className="cursor-pointer hover:underline">로그인</Link>
              <span className="mx-1">|</span>
              <Link href="/register" className="cursor-pointer hover:underline">회원가입</Link>
            </>
          )}
        </div>

        {/* 관리 메뉴 구분선 */}
        <hr className="border-white/50 my-3" />

        {/* 메인 메뉴 목록 */}
        <ul className="mt-2 space-y-2 text-sm">
          <li className="cursor-pointer hover:text-cyan-400">📄 문서 생성</li>
          <li className="cursor-pointer hover:text-cyan-400">🖼 이미지 업로드</li>
          <li className="cursor-pointer hover:text-cyan-400">
            <Link href="/manage/category" className="menu-link">
              📂 카테고리 관리
            </Link>
          </li>
          <li className="cursor-pointer hover:text-cyan-400">🗂 문서 구조 보기</li>
          <li className="cursor-pointer hover:text-cyan-400">⚙️ 설정</li>
        </ul>
      </div>

      {/* 닫기 버튼*/}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 bg-zinc-800 rounded-r px-2 py-1 cursor-pointer"
        onClick={onClose}
        aria-label="사이드 메뉴 닫기"
      >
        <span className="text-xl">◀</span>
      </div>
    </div>
  );
}
