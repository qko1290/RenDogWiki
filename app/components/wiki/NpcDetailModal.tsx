// =============================================
// File: components/wiki/NpcDetailModal.tsx
// =============================================
'use client';

import React, { useEffect } from 'react';
import NpcPictureSlider from './NpcPictureSlider';
import '@/wiki/css/wiki-detail-modal.css';
import { toProxyUrl } from '@lib/cdn'; // ✅ 추가

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
      <div className="npc-modal-main" onClick={(e) => e.stopPropagation()}>
        {/* 좌측: 아이콘 + 사진 */}
        <div className="npc-modal-left">
          <div className="npc-modal-profile">
            {npc.icon?.startsWith('http') ? (
              <img
                src={toProxyUrl(npc.icon)}          // ✅ CloudFront 리라이트
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

          {/* 사진들도 모두 CDN 경유 */}
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
              <div className="mgr-pill-row">
                <span className="mgr-pill-label">퀘스트</span>
                <span className="mgr-pill-value">
                  {npc.quest?.trim() ? npc.quest : <span className="mgr-placeholder">-</span>}
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

              <div className="mgr-pill-row">
                <span className="mgr-pill-label">선행조건</span>
                <span className="mgr-pill-value">
                  {npc.requirement?.trim() ? npc.requirement : <span className="mgr-placeholder">-</span>}
                </span>
              </div>
            </>
          )}

          {/* 대사: 공통 */}
          <div className="mgr-pill-row mgr-pill-row--multi">
            <span className="mgr-pill-label">대사</span>
            <span className="mgr-pill-value">
              {npc.line?.trim() ? (
                <span style={{ whiteSpace: 'pre-wrap' }}>{npc.line}</span>
              ) : (
                <span className="mgr-placeholder">- 대사 없음 -</span>
              )}
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
