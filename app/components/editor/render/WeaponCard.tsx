// components/editor/render/WeaponCard.tsx
import React from 'react';
import { ReactEditor } from 'slate-react';
import type { RenderElementProps } from 'slate-react';
import { Transforms } from 'slate';
import { toProxyUrl } from '@lib/cdn';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import type {
  WeaponCardElement,
  WeaponStatConfig,
  WeaponType,
  WeaponStatKey,
} from '@/types/slate';
import {
  WEAPON_TYPES_META,
  ensureWeaponStats,
  normalizeStatsForWeaponType,
} from './weaponStatUtils';
import {
  WeaponTypeSelectModal,
  WeaponNameEditModal,
  WeaponStatEditModal,
  WeaponStatSelectModal,
  WeaponVideoModal,
} from './WeaponModals';

// Element.tsx 에서 넘겨주는 실제 props 모양대로 정의
export interface WeaponCardProps {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: WeaponCardElement;
  editor: any;
}

export function WeaponCard(props: WeaponCardProps) {
  const { attributes, children, element, editor } = props;
  const el = element as WeaponCardElement;
  const path = ReactEditor.findPath(editor, element);
  const isReadOnly = ReactEditor.isReadOnly(editor);

  const weaponType: WeaponType = el.weaponType || 'epic';
  const VIDEOLESS_TYPES = new Set<WeaponType>(['boss', 'mini-boss', 'monster']);
  const supportsVideo = !VIDEOLESS_TYPES.has(weaponType);
  const meta = WEAPON_TYPES_META[weaponType];

  // ✅ TRANSCEND 카드만 화려하게 만들기 위한 플래그
  const isTranscend =
    (meta?.label ? meta.label.toUpperCase().startsWith("TRANSCEND") : false) ||
    String(weaponType || "").toLowerCase().startsWith("transcend");

  // ✅ 색상 -> rgba (WeaponCard.tsx에는 없으니 여기서만 로컬로)
  const hexToRgba = (hex: string, alpha: number) => {
    const h = (hex || "").replace("#", "").trim();
    const a = Math.max(0, Math.min(1, alpha));
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return `rgba(255,255,255,${a})`;
  };

  // ✅ 초월 프레임/글로우/샤인에 쓸 값들
  const tBorder = meta?.border || "#a855f7";
  const tHeader = meta?.headerBg || "#7c3aed";

  const transcendFrameStyle: React.CSSProperties = {
    padding: 2,
    borderRadius: 20,
    background: `linear-gradient(135deg, ${meta.headerBg} 0%, ${meta.border} 45%, #ffffff 60%, ${meta.headerBg} 100%)`,
    boxShadow:
      `0 0 0 1px rgba(255,255,255,.18) inset,
      0 18px 55px rgba(0,0,0,.55),
      0 0 28px rgba(255,255,255,.12),
      0 0 40px ${meta.headerBg}55`,
  };

  const transcendInnerGlowStyle: React.CSSProperties = {
    borderRadius: 18,
    overflow: 'hidden',
    background:
      `radial-gradient(circle at 20% 0%, ${meta.border}22, transparent 55%),
      radial-gradient(circle at 100% 0%, ${meta.headerBg}2a, transparent 60%),
      radial-gradient(circle at 50% 110%, rgba(255,255,255,.08), transparent 50%),
      #020617`,
    boxShadow: `0 0 0 1px rgba(255,255,255,.10) inset`,
    position: 'relative',
  };

  const stats = ensureWeaponStats(el.stats, weaponType);
  const visibleStats = stats.filter((s) => s.enabled);

  const [typeModalOpen, setTypeModalOpen] = React.useState(false);
  const [nameModalOpen, setNameModalOpen] = React.useState(false);
  const [imageModalOpen, setImageModalOpen] = React.useState(false);
  const [videoSelectOpen, setVideoSelectOpen] = React.useState(false);
  const [videoModalOpen, setVideoModalOpen] = React.useState(false);
  const [statEditKey, setStatEditKey] =
    React.useState<WeaponStatKey | null>(null);
  const [statSelectOpen, setStatSelectOpen] = React.useState(false);

  // ✅ 우클릭 삭제 메뉴 위치
  const [contextMenuPos, setContextMenuPos] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const updateElement = (patch: Partial<WeaponCardElement>) => {
    Transforms.setNodes<WeaponCardElement>(editor, patch, { at: path });
  };

  const handleWeaponTypeChange = (next: WeaponType) => {
    if (next === weaponType) return;

    const nextStats = normalizeStatsForWeaponType(stats, next);

    updateElement({
      weaponType: next,
      stats: nextStats,

      // ✅ BOSS / MINI BOSS / MONSTER는 영상 자체가 없으니 기존 값도 제거
      ...(VIDEOLESS_TYPES.has(next) ? { videoUrl: null } : {}),
    });

    // (선택) 혹시 열려있던 모달이 있으면 닫아주기
    if (VIDEOLESS_TYPES.has(next)) {
      setVideoSelectOpen(false);
      setVideoModalOpen(false);
    }
  };

  const handleSaveStat = (updated: WeaponStatConfig) => {
    const nextStats = stats.map((s) =>
      s.key === updated.key ? updated : s,
    );
    updateElement({ stats: nextStats });
  };

  const handleSaveStatsSelection = (nextStats: WeaponStatConfig[]) => {
    updateElement({
      stats: normalizeStatsForWeaponType(nextStats, weaponType),
    });
  };

  const handleImageSelected = (url: string) => {
    updateElement({ imageUrl: url });
    setImageModalOpen(false);
  };

  const handleVideoSelected = (url: string) => {
    if (!supportsVideo) return; // ✅ boss/mini-boss/monster 방어
    updateElement({ videoUrl: url });
    setVideoSelectOpen(false);
  };

  const cardWidth = 260;

  const videoSrc =
    supportsVideo && el.videoUrl
      ? (el.videoUrl.startsWith('http') ? toProxyUrl(el.videoUrl) : el.videoUrl)
      : '';

  const imageSrc =
    el.imageUrl && el.imageUrl.startsWith('http')
      ? toProxyUrl(el.imageUrl)
      : el.imageUrl || '';

  // 에디터 모드에서만 보이는 설정 버튼들
  const showConfigButtons = !isReadOnly;

  return (
    <div {...attributes}>
      {/* ✅ 무기 카드 + 정보 설정 버튼을 중앙 정렬 */}
      <div
        contentEditable={false}
        style={{
          margin: '14px 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 10,
        }}
        onContextMenu={(e) => {
          // ✅ 읽기 전용이 아닐 때만 삭제 컨텍스트 메뉴
          if (isReadOnly) return;
          e.preventDefault();
          e.stopPropagation();
          setContextMenuPos({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* 카드 본체 */}
        <div style={isTranscend ? transcendFrameStyle : undefined}>
          <div
            style={{
              width: cardWidth,
              borderRadius: 18,
              overflow: "hidden",
              background: "#020617",
              boxShadow: "0 18px 45px rgba(0,0,0,.45)",
              fontFamily: "inherit",
              paddingTop: 8,

              ...(isTranscend ? transcendInnerGlowStyle : null),
            }}
          >
          {/* 상단 타입 바 */}
          <button
            type="button"
            onClick={() => !isReadOnly && setTypeModalOpen(true)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: meta.headerBg,
              color: '#f9fafb',
              padding: '6px 0',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1.5,
              textAlign: 'center',
              cursor: isReadOnly ? 'default' : 'pointer',
            }}
          >
            {meta.label}
          </button>

          {/* 무기 이름 */}
          <div
            onClick={() => !isReadOnly && setNameModalOpen(true)}
            style={{
              padding: '10px 14px',
              background: '#020617',
              color: '#e5e7eb',
              fontSize: 18,
              fontWeight: 700,
              textAlign: 'center',
              borderBottom: '1px solid #111827',
              cursor: isReadOnly ? 'default' : 'pointer',
              userSelect: 'none',
            }}
          >
            {el.name || '새 무기 이름'}
          </div>

          {/* 이미지 영역 */}
          <div
            onClick={() => !isReadOnly && setImageModalOpen(true)}
            style={{
              background:
                'radial-gradient(circle at 20% 0%, rgba(56,189,248,0.18), transparent 55%), ' +
                'radial-gradient(circle at 100% 0%, rgba(129,140,248,0.22), transparent 55%), ' +
                '#020617',
              height: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isReadOnly ? 'default' : 'pointer',
            }}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt=""
                width={160}
                height={96}
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{
                  maxWidth: '80%',
                  maxHeight: '80%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.55))',
                  display: 'block',
                }}
              />
            ) : (
              <span
                style={{
                  color: '#6b7280',
                  fontSize: 14,
                }}
              >
                이미지 없음
              </span>
            )}
          </div>

          {/* 정보 리스트 */}
          <div
            style={{
              padding: '8px 10px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {visibleStats.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'rgba(15,23,42,.75)',
                }}
              >
                표시할 정보가 없습니다. (정보 설정 버튼으로 추가)
              </div>
            )}

            {visibleStats.map((stat) => (
              <button
                key={stat.key}
                type="button"
                onClick={() => setStatEditKey(stat.key)}
                style={{
                  borderRadius: 10,
                  padding: '6px 8px',
                  border: '1px solid #111827',
                  background:
                    'linear-gradient(90deg, rgba(15,23,42,.95), rgba(15,23,42,.85))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                title="클릭해서 강화별 상세 정보 보기/편집"
              >
                <span
                  style={{
                    fontSize: 12,
                    color: '#9ca3af',
                    fontWeight: 500,
                  }}
                >
                  {stat.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: '#e5e7eb',
                    fontWeight: 600,
                  }}
                >
                  {stat.summary || '-'}
                  {stat.unit ? ` ${stat.unit}` : ''}
                </span>
              </button>
            ))}
          </div>

          {/* 하단 영상 버튼 */}
          {supportsVideo && (
            <div
              style={{
                padding: '8px 10px 10px',
                display: 'flex',
                gap: showConfigButtons ? 8 : 0,
                justifyContent: showConfigButtons ? 'stretch' : 'center',
              }}
            >
              {/* ✅ 문서 로드(readOnly)에서는 가운데 정렬 + 단일 버튼 */}
              <button
                type="button"
                disabled={!videoSrc}
                onClick={() => videoSrc && setVideoModalOpen(true)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  background: videoSrc
                    ? 'linear-gradient(90deg,#1d4ed8,#3b82f6)'
                    : '#111827',
                  color: videoSrc ? '#f9fafb' : '#6b7280',
                  cursor: videoSrc ? 'pointer' : 'default',
                  flex: showConfigButtons ? 1 : undefined,
                  minWidth: showConfigButtons ? undefined : 160,
                  textAlign: 'center',
                  boxShadow: videoSrc
                    ? '0 12px 30px rgba(37,99,235,0.7)'
                    : 'none',
                }}
              >
                스킬 사용 영상
              </button>

              {/* 영상 설정 버튼은 에디터에서만 표시 */}
              {showConfigButtons && (
                <button
                  type="button"
                  onClick={() => setVideoSelectOpen(true)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 999,
                    border: '1px solid #334155',
                    background: '#020617',
                    color: '#e5e7eb',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  영상 설정
                </button>
              )}
            </div>
          )}
        </div>

        {/* ✅ 정보 설정 버튼: 카드 “밖”에 배치 (에디터에서만) */}
        {showConfigButtons && (
          <button
            type="button"
            onClick={() => setStatSelectOpen(true)}
            style={{
              alignSelf: 'flex-start',
              marginTop: 8,
              fontSize: 11,
              borderRadius: 999,
              padding: '4px 10px',
              border: '1px solid #4b5563',
              background: '#020617',
              color: '#9ca3af',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="표시할 정보 선택"
          >
            정보 설정
          </button>
        )}
      </div>

      {children}

      {/* ✅ 우클릭 삭제 컨텍스트 메뉴 (에디터에서만) */}
      {!isReadOnly && contextMenuPos && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2050,
            background: 'transparent',
          }}
          onMouseDown={() => setContextMenuPos(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: contextMenuPos.x,
              top: contextMenuPos.y,
            }}
          >
            <div
              style={{
                minWidth: 150,
                padding: '4px 0',
                borderRadius: 8,
                background: '#020617',
                border: '1px solid #4b5563',
                boxShadow: '0 8px 24px rgba(0,0,0,.6)',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  Transforms.removeNodes(editor, { at: path });
                  setContextMenuPos(null);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: '#fca5a5',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                무기 카드 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달들 (기존 로직 유지) */}
      <WeaponTypeSelectModal
        open={typeModalOpen && !isReadOnly}
        currentType={weaponType}
        onClose={() => setTypeModalOpen(false)}
        onSelect={(t) => {
          handleWeaponTypeChange(t);
          setTypeModalOpen(false);
        }}
      />

      <WeaponNameEditModal
        open={nameModalOpen && !isReadOnly}
        initialName={el.name}
        onClose={() => setNameModalOpen(false)}
        onSave={(name) => {
          updateElement({ name });
          setNameModalOpen(false);
        }}
      />

      <ImageSelectModal
        open={imageModalOpen && !isReadOnly}
        onClose={() => setImageModalOpen(false)}
        onSelectImage={handleImageSelected}
      />
      {supportsVideo && (
        <ImageSelectModal
          open={videoSelectOpen && !isReadOnly}
          onClose={() => setVideoSelectOpen(false)}
          onSelectImage={handleVideoSelected}
        />
      )}

      <WeaponStatEditModal
        open={!!statEditKey}
        weaponType={weaponType}
        stats={stats}
        statKey={statEditKey}
        readOnly={isReadOnly}
        onClose={() => setStatEditKey(null)}
        onSave={(updated) => {
          handleSaveStat(updated);
          setStatEditKey(null);
        }}
      />

      <WeaponStatSelectModal
        open={statSelectOpen && !isReadOnly}
        weaponType={weaponType}
        stats={stats}
        onClose={() => setStatSelectOpen(false)}
        onSave={(nextStats) => {
          handleSaveStatsSelection(nextStats);
          setStatSelectOpen(false);
        }}
      />

      {supportsVideo && (
        <WeaponVideoModal
          open={videoModalOpen && !!videoSrc}
          url={videoSrc}
          onClose={() => setVideoModalOpen(false)}
        />
      )}
    </div>
    </div>
  );
}

export default WeaponCard;
