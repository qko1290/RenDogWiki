// =============================================
// File: components/wiki/HeadDetailModal.tsx
// =============================================
'use client';

/**
 * 머리(Head) 상세 모달
 * - 좌: 문서 아이콘 + 사진 슬라이더
 * - 우: 좌표(Pill UI)
 * - 배경 클릭 시 닫힘, 내부 클릭은 전파 차단
 * - body 스크롤 잠금 클래스(rd-modal-open) 적용/해제
 */

import React, { useEffect } from "react";
import NpcPictureSlider from "./NpcPictureSlider";
import "@/wiki/css/wiki-detail-modal.css";

export type Head = {
  id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
};

type Props = {
  head: Head;
  /** 문서 아이콘(이모지 or URL). 없으면 🧭 사용 */
  docIcon?: string;
  onClose: () => void;
};

export default function HeadDetailModal({ head, docIcon, onClose }: Props) {
  // 바디 스크롤 잠금 (NPC 모달과 동일)
  useEffect(() => {
    document.body.classList.add("rd-modal-open");
    return () => document.body.classList.remove("rd-modal-open");
  }, []);

  const headerIcon =
    docIcon
      ? (docIcon.startsWith("http")
          ? <img src={docIcon} alt="icon" className="npc-modal-icon" />
          : <span style={{ fontSize: 56 }}>{docIcon}</span>)
      : <span style={{ fontSize: 56 }}>🧭</span>;

  return (
    <div className="npc-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="npc-modal-main" onClick={(e) => e.stopPropagation()}>
        {/* 좌측: 아이콘 + 사진 슬라이더 */}
        <div className="npc-modal-left">
          <div className="npc-modal-profile">
            {headerIcon}
            <div className="npc-modal-name">{head.order}번 머리</div>
          </div>
          <NpcPictureSlider pictures={head.pictures || []} />
        </div>

        {/* 우측: Pill UI (위치만 필요) */}
        <div className="npc-modal-right">
          <div className="mgr-pill-row">
            <span className="mgr-pill-label">위치</span>
            <span className="mgr-pill-value">
              <span className="quest-detail-loc">
                ( {head.location_x}, {head.location_y}, {head.location_z} )
              </span>
            </span>
          </div>
        </div>

        <button className="npc-modal-close-btn" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
    </div>
  );
}
