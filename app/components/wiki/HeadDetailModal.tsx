// components/wiki/HeadDetailModal.tsx
'use client';

import React, { useEffect } from "react";
import NpcPictureSlider from "./NpcPictureSlider";
import "@/wiki/css/wiki-detail-modal.css";
import { toProxyUrl } from "@lib/cdn";

/** WikiPageInner에서 넘기는 selectedHead(HeadRow)와 호환될 수 있게 넓은 타입 */
export type HeadLike = {
  id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
};

/** (충돌 방지를 위해) 명시적인 이름으로 변경 */
export type HeadDetailModalProps = {
  head: HeadLike;
  /** 문서 아이콘(이모지 or URL). 없으면 🧭 사용 */
  docIcon?: string;
  onClose: () => void;
};

const HeadDetailModal: React.FC<HeadDetailModalProps> = ({ head, docIcon, onClose }) => {
  useEffect(() => {
    document.body.classList.add("rd-modal-open");
    return () => document.body.classList.remove("rd-modal-open");
  }, []);

  const headerIcon = docIcon
    ? (docIcon.startsWith("http")
        ? <img src={toProxyUrl(docIcon)} alt="icon" className="npc-modal-icon" loading="lazy" decoding="async" />
        : <span style={{ fontSize: 56 }}>{docIcon}</span>)
    : <span style={{ fontSize: 56 }}>🧭</span>;

  return (
    <div className="npc-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="npc-modal-main" onClick={(e) => e.stopPropagation()}>
        <div className="npc-modal-left">
          <div className="npc-modal-profile">
            {headerIcon}
            <div className="npc-modal-name">{head.order}번 머리</div>
          </div>
          <NpcPictureSlider pictures={head.pictures || []} />
        </div>

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

        <button className="npc-modal-close-btn" onClick={onClose} aria-label="닫기">×</button>
      </div>
    </div>
  );
};

export default HeadDetailModal;
