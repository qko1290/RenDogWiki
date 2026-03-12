// =============================================
// File: components/wiki/NpcDetailModal.tsx
// =============================================
'use client';

import React, { useEffect } from 'react';
import NpcPictureSlider from './NpcPictureSlider';
import '@/wiki/css/wiki-detail-modal.css';
import { toProxyUrl } from '@lib/cdn';

type Reward = { icon?: string; text: string };
export type Npc = {
  id: number;
  name: string;
  icon: string;
  pictures?: string[];
  location_x: number;
  location_y: number;
  location_z: number;
  line?: string;
  quest?: string;
  rewards?: Reward[];
  requirement?: string;
  tag?: string | null;
};

type Props = {
  npc: Npc;
  onClose: () => void;
  /** 퀘스트 상세면 'quest', 일반 NPC면 'npc' (위치/대사만 표시) */
  mode?: 'quest' | 'npc';
};

export default function NpcDetailModal({ npc, onClose, mode = 'quest' }: Props) {
  useEffect(() => {
    document.body.classList.add('rd-modal-open');
    return () => document.body.classList.remove('rd-modal-open');
  }, []);

  const isQuest = mode === 'quest';

  return (
    <div className="npc-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="npc-modal-main"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        {/* 좌측: 아이콘 + 사진 */}
        <div className="npc-modal-left">
          <div className="npc-modal-profile">
            {npc.icon?.startsWith('http') ? (
              <img
                src={toProxyUrl(npc.icon)}
                alt="icon"
                className="npc-modal-icon"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span style={{ fontSize: 56 }}>{npc.icon || '🧑'}</span>
            )}
            <div className="npc-modal-name">{npc.name}</div>
          </div>

          <NpcPictureSlider pictures={(npc.pictures || []).map(toProxyUrl)} />
        </div>

        {/* 우측: Pill UI */}
        <div className="npc-modal-right">
          {/* 위치: 공통 */}
          <div className="mgr-pill-row">
            <span className="mgr-pill-label">위치</span>
            <span className="mgr-pill-value">
              <span className="quest-detail-loc">
                ( {npc.location_x}, {npc.location_y}, {npc.location_z} )
              </span>
            </span>
          </div>

          {/* 퀘스트 전용 필드들 */}
          {isQuest && (
            <>
              <div className="mgr-pill-row mgr-pill-row--quest">
                <span className="mgr-pill-label">퀘스트</span>
                <span className="mgr-pill-value">
                  {npc.quest?.trim() ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{npc.quest}</span>
                  ) : (
                    <span className="mgr-placeholder">-</span>
                  )}
                </span>
              </div>

              <div className="mgr-pill-row">
                <span className="mgr-pill-label">보상</span>
                <span className="mgr-pill-value" style={{ flexWrap: 'wrap' }}>
                  {Array.isArray(npc.rewards) && npc.rewards.length > 0 ? (
                    npc.rewards.map((rw, i) => (
                      <span key={i} className="mgr-chip">
                        {rw.icon ? (
                          rw.icon.startsWith('http') ? (
                            <img src={toProxyUrl(rw.icon)} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span className="mgr-chip-emoji">{rw.icon}</span>
                          )
                        ) : null}
                        <span>{rw.text}</span>
                      </span>
                    ))
                  ) : (
                    <span className="mgr-placeholder">-</span>
                  )}
                </span>
              </div>

              {/* requirement가 비어 있으면 칸 자체를 렌더링 안함 */}
              {npc.requirement?.trim() && (
                <div className="mgr-pill-row">
                  <span className="mgr-pill-label">선행조건</span>
                  <span className="mgr-pill-value">{npc.requirement}</span>
                </div>
              )}
            </>
          )}

          {/* 대사: 공통 */}
          <div className="mgr-pill-row mgr-pill-row--multi">
            <span className="mgr-pill-label">대사</span>

            {/* ✅ span -> div로 바꿔서 스크롤 컨테이너로 만듦 */}
            <div className="mgr-pill-value">
              {npc.line?.trim() ? (
                <div
                  className="npc-line-scroll"
                  style={{
                    maxHeight: 240,          // ✅ 원하는 최대 높이 (px)
                    overflowY: 'auto',       // ✅ 세로 스크롤
                    whiteSpace: 'pre-wrap',  // ✅ 줄바꿈 유지
                    wordBreak: 'break-word', // ✅ 긴 문자열 줄바꿈
                    paddingRight: 6,         // ✅ 스크롤바 때문에 글자 붙는 것 방지
                  }}
                >
                  {npc.line}
                </div>
              ) : (
                <span className="mgr-placeholder">- 대사 없음 -</span>
              )}
            </div>
          </div>
        </div>

        <button className="npc-modal-close-btn" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
    </div>
  );
}