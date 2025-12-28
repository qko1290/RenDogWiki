// C:\next\rdwiki\app\components\editor\render\WeaponCard.tsx
import React, { useMemo, useState } from 'react';
import type { RenderElementProps } from 'slate-react';
import { ReactEditor } from 'slate-react';
import { Transforms } from 'slate';
import { toProxyUrl } from '@lib/cdn';
import type { Editor } from 'slate';

import ImageSelectModal from '@/components/image/ImageSelectModal';

import type { WeaponCardElement, WeaponStatConfig, WeaponStatKey, WeaponType } from "@/types/slate";

import {
  WEAPON_TYPES_META,
  ensureWeaponStats,
  getWeaponLevelLabels,
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
  editor: Editor;
}

// 파일 분리 없이도 동작하게 인라인으로 둠 (./WeaponLevelSelector 의존성 제거)
function WeaponLevelSelector({
  levelLabels,
  selectedIndex,
  onChange,
}: {
  levelLabels: string[];
  selectedIndex: number;
  onChange: (idx: number) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!levelLabels.length) return null;

  const selectedLabel = levelLabels[selectedIndex] ?? '-';

  return (
    <div
      style={{ position: 'relative', width: 120, paddingTop: 8 }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          borderRadius: 999,
          padding: '8px 10px',
          border: '1px solid #334155',
          background: '#0b1220',
          color: '#e5e7eb',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {selectedLabel}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 0,
            right: 0,
            zIndex: 50,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #111827',
            background: 'rgba(2,6,23,.96)',
            boxShadow: '0 18px 45px rgba(0,0,0,.55)',
          }}
        >
          {levelLabels.map((lb, idx) => {
            const active = idx === selectedIndex;
            return (
              <button
                key={lb + idx}
                type="button"
                onClick={() => {
                  onChange(idx);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  padding: '8px 10px',
                  border: 'none',
                  background: active ? 'rgba(59,130,246,.18)' : 'transparent',
                  color: active ? '#f9fafb' : '#cbd5e1',
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                {lb}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isTranscendType(type: string) {
  // "transcend-epic" / "transcend_superior" 등
  return type.startsWith('transcend-') || type.startsWith('transcend_');
}

export default function WeaponCard(props: WeaponCardProps) {
  const { attributes, children, element: el, editor } = props;

  const isReadOnly = ReactEditor.isReadOnly(editor);

  const weaponType = (el.weaponType || 'epic') as WeaponType;
  const meta = WEAPON_TYPES_META[weaponType] ?? WEAPON_TYPES_META.epic;

  const stats = useMemo(() => ensureWeaponStats(el.stats, weaponType), [weaponType, el.stats]);

  const enabledStats = useMemo(() => stats.filter((s) => s.enabled), [stats]);

  // boss / monster 는 영상 영역 자체가 없음
  const VIDEOLESS_TYPES: WeaponType[] = useMemo(
    () =>
      [
        // (네 프로젝트에서 이미 추가된 타입들)
        'boss' as WeaponType,
        'mini-boss' as WeaponType,
        'monster' as WeaponType,
      ].filter(Boolean),
    []
  );

  const supportsVideo = !VIDEOLESS_TYPES.includes(weaponType);

  const levelLabels = useMemo(() => getWeaponLevelLabels(weaponType), [weaponType]);
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(0);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [statSelectOpen, setStatSelectOpen] = useState(false);
  const [statEditOpen, setStatEditOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [videoSelectOpen, setVideoSelectOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const [editingStatKey, setEditingStatKey] = useState<WeaponStatKey | null>(null);

  // 우클릭 삭제 메뉴
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const name = el.name || '새 무기 이름';

  const imageSrc =
    el.imageUrl && el.imageUrl.startsWith('http') ? toProxyUrl(el.imageUrl) : el.imageUrl || '';

  const videoSrc =
    supportsVideo && el.videoUrl
      ? el.videoUrl.startsWith('http')
        ? toProxyUrl(el.videoUrl)
        : el.videoUrl
      : '';

  // 에디터 모드에서만 보이는 설정 버튼들
  const showConfigButtons = !isReadOnly;

  const updateElement = (patch: Partial<WeaponCardElement>) => {
    const path = ReactEditor.findPath(editor, el);
    Transforms.setNodes(editor, patch, { at: path });
  };

  const handleWeaponTypeChange = (next: WeaponType) => {
    if (next === weaponType) return;
    const nextStats = normalizeStatsForWeaponType(stats, next);
    updateElement({ weaponType: next, stats: nextStats });
    setSelectedLevelIndex(0);
  };

  const handleSaveName = (nextName: string) => {
    updateElement({ name: nextName });
  };

  const handleSaveStatsSelection = (nextStats: WeaponStatConfig[]) => {
    updateElement({ stats: nextStats });
  };

  const handleSaveStat = (nextStat: WeaponStatConfig) => {
    const nextStats = stats.map((s) => (s.key === nextStat.key ? nextStat : s));
    updateElement({ stats: nextStats });
  };

  const handleImageSelect = (url: string) => {
    updateElement({ imageUrl: url });
  };

  const handleVideoSelect = (url: string) => {
    updateElement({ videoUrl: url });
  };

  const getStatDisplay = (stat: WeaponStatConfig) => {
    const lv = stat.levels?.[selectedLevelIndex];
    const value = (lv?.value ?? stat.summary ?? '') as string;
    const unit = stat.unit ?? '';
    return { value, unit };
  };

  // =========================
  // ✅ 초월 카드 번쩍 스타일 (보더/글로우만 “화려하게”)
  // =========================
  const transcend =
    isTranscendType(String(weaponType)) || meta.label.toUpperCase().startsWith('TRANSCEND');

  const cardWidth = 320;

  const transcendOuterStyle: React.CSSProperties = {
    width: cardWidth,
    borderRadius: 20,
    padding: 2,
    background: `linear-gradient(135deg,
      ${meta.headerBg} 0%,
      ${meta.border} 35%,
      rgba(255,255,255,.95) 52%,
      ${meta.border} 68%,
      ${meta.headerBg} 100%)`,
    boxShadow: `0 0 0 1px rgba(255,255,255,.18) inset,
                0 18px 55px rgba(0,0,0,.55),
                0 0 28px rgba(255,255,255,.12),
                0 0 46px ${meta.headerBg}55`,
    position: 'relative',
    overflow: 'hidden',
  };

  const shimmerStyle: React.CSSProperties = {
    position: 'absolute',
    top: -40,
    left: -120,
    width: 140,
    height: '160%',
    transform: 'skewX(-18deg)',
    background:
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 100%)',
    animation: 'rdwiki_transcend_shimmer 3.8s ease-in-out infinite',
    pointerEvents: 'none',
    mixBlendMode: 'screen',
    opacity: 0.65,
  };

  return (
  <div {...attributes}>
    {transcend && (
      <style>
        {`
          @keyframes rdwiki_transcend_shimmer {
            0% { transform: translateX(0) skewX(-18deg); opacity: 0; }
            10% { opacity: .55; }
            50% { opacity: .85; }
            90% { opacity: .55; }
            100% { transform: translateX(260%) skewX(-18deg); opacity: 0; }
          }
        `}
      </style>
    )}

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
        if (isReadOnly) return;
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* ✅ 초월 프레임은 “카드 본체만” 감싼다 (오른쪽 컨트롤은 절대 포함 X) */}
      <div style={transcend ? transcendOuterStyle : undefined}>
        {transcend && <div style={shimmerStyle} />}

        {/* 카드 본체 */}
        <div
          style={{
            width: cardWidth,
            borderRadius: 18,
            overflow: 'hidden',
            background: '#020617',
            boxShadow: '0 18px 45px rgba(0,0,0,.45)',
            fontFamily: 'inherit',
            paddingTop: 8,
          }}
        >
          {/* 상단 타입 바 */}
          <div
            onClick={() => !isReadOnly && setTypeModalOpen(true)}
            style={{
              width: '100%',
              background: meta.headerBg,
              color: '#f9fafb',
              padding: '6px 0',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1.5,
              textAlign: 'center',
              cursor: isReadOnly ? 'default' : 'pointer',
              userSelect: 'none',
            }}
            title={isReadOnly ? undefined : '타입 변경'}
          >
            {meta.label}
          </div>

          {/* 이름 */}
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
            title={isReadOnly ? undefined : '이름 변경'}
          >
            {name}
          </div>

          {/* 이미지 */}
          <div
            onClick={() => !isReadOnly && setImageModalOpen(true)}
            style={{
              background:
                `radial-gradient(circle at 20% 0%, ${meta.border}33, transparent 55%), ` +
                `radial-gradient(circle at 100% 0%, ${meta.headerBg}33, transparent 55%), ` +
                '#020617',
              height: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isReadOnly ? 'default' : 'pointer',
            }}
            title={isReadOnly ? undefined : '이미지 선택'}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={name}
                width={160}
                height={96}
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{
                  maxWidth: '80%',
                  maxHeight: '80%',
                  objectFit: 'contain',
                  background: 'transparent',
                  imageRendering: 'pixelated',
                  display: 'block',
                  borderRadius: 10,
                }}
              />
            ) : (
              <span style={{ color: '#6b7280', fontSize: 14 }}>이미지 없음</span>
            )}
          </div>

          {/* 스탯 */}
          <div
            style={{
              padding: '8px 10px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {enabledStats.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'rgba(15,23,42,.75)',
                }}
              >
                표시할 정보가 없습니다.
              </div>
            )}

            {enabledStats.map((stat) => {
              const { value, unit } = getStatDisplay(stat);
              return (
                <div
                  key={stat.key || stat.label}
                  onClick={() => {
                    if (isReadOnly) return;
                    setEditingStatKey(stat.key);
                    setStatEditOpen(true);
                  }}
                  style={{
                    borderRadius: 10,
                    padding: '6px 8px',
                    border: '1px solid #111827',
                    background:
                      'linear-gradient(90deg, rgba(15,23,42,.95), rgba(15,23,42,.85))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: isReadOnly ? 'default' : 'pointer',
                  }}
                  title={isReadOnly ? undefined : '스탯 편집'}
                >
                  <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                    {stat.label}
                  </span>
                  <span style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>
                    {value || '-'}
                    {unit ? ` ${unit}` : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 영상 영역 (지원 타입만) */}
          {supportsVideo && (
            <div
              style={{
                padding: '8px 10px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>
                스킬 사용 영상
              </div>

              {showConfigButtons ? (
                <button
                  type="button"
                  onClick={() => setVideoSelectOpen(true)}
                  style={{
                    fontSize: 11,
                    borderRadius: 999,
                    padding: '6px 10px',
                    border: '1px solid #334155',
                    background: '#0b1220',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  영상 설정
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!videoSrc}
                  onClick={() => videoSrc && setShowVideo(true)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 999,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    background: videoSrc ? 'linear-gradient(90deg,#1d4ed8,#3b82f6)' : '#111827',
                    color: videoSrc ? '#f9fafb' : '#6b7280',
                    cursor: videoSrc ? 'pointer' : 'default',
                    minWidth: 160,
                    textAlign: 'center',
                    boxShadow: videoSrc ? '0 12px 30px rgba(37,99,235,0.7)' : 'none',
                  }}
                >
                  스킬 사용 영상
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ✅ 오른쪽 컨트롤 컬럼 (카드 밖: 테두리/글로우에 영향 주면 안 됨) */}
      {showConfigButtons && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'flex-start',
            paddingTop: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setStatSelectOpen(true)}
            style={{
              fontSize: 11,
              borderRadius: 999,
              padding: '6px 10px',
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

          {levelLabels.length > 1 && (
            <WeaponLevelSelector
              levelLabels={levelLabels}
              selectedIndex={selectedLevelIndex}
              onChange={(idx: number) => setSelectedLevelIndex(idx)}
            />
          )}
        </div>
      )}

      {/* ✅ 읽기 모드: 강수 선택만 필요한 경우 카드 옆에만 유지 */}
      {!showConfigButtons && levelLabels.length > 1 && (
        <WeaponLevelSelector
          levelLabels={levelLabels}
          selectedIndex={selectedLevelIndex}
          onChange={(idx: number) => setSelectedLevelIndex(idx)}
        />
      )}
    </div>

    {/* 우클릭 메뉴 */}
    {contextMenuPos && !isReadOnly && (
      <div
        contentEditable={false}
        style={{
          position: 'fixed',
          top: contextMenuPos.y,
          left: contextMenuPos.x,
          zIndex: 9999,
          background: '#0b1220',
          border: '1px solid #1f2937',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 18px 50px rgba(0,0,0,.55)',
        }}
        onMouseLeave={() => setContextMenuPos(null)}
      >
        <button
          type="button"
          onClick={() => {
            setContextMenuPos(null);
            const path = ReactEditor.findPath(editor, el);
            Transforms.removeNodes(editor, { at: path });
          }}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: 'none',
            background: 'transparent',
            color: '#fecaca',
            fontWeight: 800,
            fontSize: 12,
            textAlign: 'left',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          카드 삭제
        </button>
      </div>
    )}

    {/* 타입 선택 모달 */}
    <WeaponTypeSelectModal
      open={typeModalOpen && !isReadOnly}
      currentType={weaponType}
      onClose={() => setTypeModalOpen(false)}
      onSelect={(next) => {
        handleWeaponTypeChange(next);
        setTypeModalOpen(false);
      }}
    />

    {/* 이름 편집 모달 */}
    <WeaponNameEditModal
      open={nameModalOpen && !isReadOnly}
      initialName={name}
      onClose={() => setNameModalOpen(false)}
      onSave={(nextName) => {
        handleSaveName(nextName);
        setNameModalOpen(false);
      }}
    />

    {/* 스탯 편집 모달 */}
    {editingStatKey && (
      <WeaponStatEditModal
        open={statEditOpen && !isReadOnly}
        weaponType={weaponType}
        stats={stats}
        statKey={editingStatKey}
        readOnly={isReadOnly}
        onClose={() => setStatEditOpen(false)}
        onSave={(next) => {
          handleSaveStat(next);
          setStatEditOpen(false);
        }}
      />
    )}

    {/* 스탯 표시 선택 모달 */}
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

    {/* 이미지 선택 모달 */}
    <ImageSelectModal
      open={imageModalOpen && !isReadOnly}
      onClose={() => setImageModalOpen(false)}
      onSelectImage={(url) => {
        handleImageSelect(url);
        setImageModalOpen(false);
      }}
    />

    {/* 영상 선택 모달 */}
    {supportsVideo && (
      <ImageSelectModal
        open={videoSelectOpen && !isReadOnly}
        onClose={() => setVideoSelectOpen(false)}
        onSelectImage={(url) => {
          handleVideoSelect(url);
          setVideoSelectOpen(false);
        }}
      />
    )}

    {/* 영상 모달 */}
    {supportsVideo && videoSrc && (
      <WeaponVideoModal open={showVideo} url={videoSrc} onClose={() => setShowVideo(false)} />
    )}

    {children}
  </div>
);
}