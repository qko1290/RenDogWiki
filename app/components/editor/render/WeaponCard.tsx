// components/editor/render/WeaponCard.tsx
// 전체 코드 / 수정본
// - 카드 디자인 JSX는 공통 WeaponCardRenderer 사용
// - 에디터 전용 모달/수정/삭제/Transforms 동작은 이 파일에 유지

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
  getWeaponLevelLabels,
} from './weaponStatUtils';

import {
  WeaponTypeSelectModal,
  WeaponNameEditModal,
  WeaponStatEditModal,
  WeaponStatSelectModal,
  WeaponVideoModal,
} from './WeaponModals';

import WeaponBlock from '@/components/wiki-render/blocks/WeaponBlock';
import WeaponCardRenderer from '@/components/wiki-render/weapon/WeaponCardRenderer';

const VIDEOLESS_TYPES = new Set<WeaponType>([
  'boss',
  'mini-boss',
  'monster',
  'rune',
  'fishing-rod',
  'armor',
]);

export interface WeaponCardProps {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: WeaponCardElement;
  editor: any;
}

function getDefaultWeaponLevelIndex(levelLabels: string[]) {
  if (!levelLabels.length) return null;

  const idxMax = levelLabels.findIndex((label) => {
    const upper = String(label ?? '').trim().toUpperCase();
    return upper === 'MAX' || upper === 'M';
  });

  return idxMax >= 0 ? idxMax : levelLabels.length - 1;
}

export function WeaponCard(props: WeaponCardProps) {
  const { attributes, children, element, editor } = props;

  const el = element as WeaponCardElement;
  const path = ReactEditor.findPath(editor, element);
  const isReadOnly = ReactEditor.isReadOnly(editor);

  const weaponType: WeaponType = el.weaponType || 'epic';
  const supportsVideo = !VIDEOLESS_TYPES.has(weaponType);
  const meta = WEAPON_TYPES_META[weaponType] ?? WEAPON_TYPES_META.epic;

  const stats = ensureWeaponStats(el.stats, weaponType);
  const visibleStats = stats.filter((stat) => stat.enabled);

  const levelLabels = React.useMemo(
    () => getWeaponLevelLabels(weaponType),
    [weaponType],
  );

  const levelSignature = levelLabels.join('|');

  const [selectedLevelIndex, setSelectedLevelIndex] = React.useState<number | null>(
    () => getDefaultWeaponLevelIndex(levelLabels),
  );

  React.useEffect(() => {
    setSelectedLevelIndex(getDefaultWeaponLevelIndex(levelLabels));
  }, [levelSignature, weaponType]);

  const [typeModalOpen, setTypeModalOpen] = React.useState(false);
  const [nameModalOpen, setNameModalOpen] = React.useState(false);
  const [imageModalOpen, setImageModalOpen] = React.useState(false);
  const [videoSelectOpen, setVideoSelectOpen] = React.useState(false);
  const [videoModalOpen, setVideoModalOpen] = React.useState(false);
  const [statEditKey, setStatEditKey] = React.useState<WeaponStatKey | null>(null);
  const [statSelectOpen, setStatSelectOpen] = React.useState(false);

  const [contextMenuPos, setContextMenuPos] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const updateElement = React.useCallback(
    (patch: Partial<WeaponCardElement>) => {
      Transforms.setNodes(editor, patch, { at: path });
    },
    [editor, path],
  );

  const handleWeaponTypeChange = React.useCallback(
    (next: WeaponType) => {
      if (next === weaponType) return;

      const nextStats = normalizeStatsForWeaponType(stats, next);

      updateElement({
        weaponType: next,
        stats: nextStats,
        ...(VIDEOLESS_TYPES.has(next) ? { videoUrl: null } : {}),
      });

      if (VIDEOLESS_TYPES.has(next)) {
        setVideoSelectOpen(false);
        setVideoModalOpen(false);
      }
    },
    [stats, updateElement, weaponType],
  );

  const handleSaveStat = React.useCallback(
    (updated: WeaponStatConfig) => {
      const nextStats = stats.map((stat) =>
        stat.key === updated.key ? updated : stat,
      );

      updateElement({ stats: nextStats });
    },
    [stats, updateElement],
  );

  const handleSaveStatsSelection = React.useCallback(
    (nextStats: WeaponStatConfig[]) => {
      updateElement({
        stats: normalizeStatsForWeaponType(nextStats, weaponType),
      });
    },
    [updateElement, weaponType],
  );

  const handleImageSelected = React.useCallback(
    (url: string) => {
      updateElement({ imageUrl: url });
      setImageModalOpen(false);
    },
    [updateElement],
  );

  const handleVideoSelected = React.useCallback(
    (url: string) => {
      if (!supportsVideo) return;

      updateElement({ videoUrl: url });
      setVideoSelectOpen(false);
    },
    [supportsVideo, updateElement],
  );

  const rawVideoUrl = String(el.videoUrl ?? '');
  const rawImageUrl = String(el.imageUrl ?? '');

  const videoSrc =
    supportsVideo && rawVideoUrl
      ? rawVideoUrl.startsWith('http')
        ? toProxyUrl(rawVideoUrl)
        : rawVideoUrl
      : '';

  const imageSrc = rawImageUrl
    ? rawImageUrl.startsWith('http')
      ? toProxyUrl(rawImageUrl)
      : rawImageUrl
    : '';

  const showConfigButtons = !isReadOnly;

  const handleOpenContextMenu = React.useCallback(
    (event: React.MouseEvent) => {
      if (isReadOnly) return;

      event.preventDefault();
      event.stopPropagation();

      setContextMenuPos({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [isReadOnly],
  );

  const content = (
    <>
      <WeaponCardRenderer
        mode="edit"
        weapon={{
          ...el,
          weaponType,
          name: el.name || '',
          imageUrl: rawImageUrl,
          videoUrl: rawVideoUrl,
        }}
        meta={meta}
        stats={visibleStats}
        imageSrc={imageSrc}
        videoSrc={videoSrc}
        supportsVideo={supportsVideo}
        selectedLevelIndex={selectedLevelIndex}
        levelLabels={levelLabels}
        onLevelChange={setSelectedLevelIndex}
        onContextMenu={handleOpenContextMenu}
        onTypeClick={
          showConfigButtons
            ? () => {
                setTypeModalOpen(true);
              }
            : undefined
        }
        onNameClick={
          showConfigButtons
            ? () => {
                setNameModalOpen(true);
              }
            : undefined
        }
        onImageClick={
          showConfigButtons
            ? () => {
                setImageModalOpen(true);
              }
            : undefined
        }
        onStatClick={
          showConfigButtons
            ? (stat) => {
                if (!stat.key) return;
                setStatEditKey(stat.key as WeaponStatKey);
              }
            : undefined
        }
        onVideoClick={() => {
          if (videoSrc) setVideoModalOpen(true);
        }}
        onVideoSettingClick={
          showConfigButtons && supportsVideo
            ? () => {
                setVideoSelectOpen(true);
              }
            : undefined
        }
        onStatSettingClick={
          showConfigButtons
            ? () => {
                setStatSelectOpen(true);
              }
            : undefined
        }
        renderImage={({ src, alt, width, height, style }) => (
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            draggable={false}
            style={style}
          />
        )}
      >
        {children}
      </WeaponCardRenderer>

      {!isReadOnly && contextMenuPos ? (
        <div
          contentEditable={false}
          suppressContentEditableWarning
          onClick={() => setContextMenuPos(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenuPos(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'fixed',
              left: contextMenuPos.x,
              top: contextMenuPos.y,
              minWidth: 150,
              padding: 6,
              borderRadius: 10,
              border: '1px solid #334155',
              background: '#020617',
              boxShadow: '0 18px 40px rgba(0,0,0,.45)',
              color: '#e5e7eb',
              zIndex: 9999,
            }}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                Transforms.removeNodes(editor, { at: path });
                setContextMenuPos(null);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                border: 'none',
                borderRadius: 8,
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
      ) : null}

      <WeaponTypeSelectModal
        open={typeModalOpen}
        currentType={weaponType}
        onClose={() => setTypeModalOpen(false)}
        onSelect={(type) => {
          handleWeaponTypeChange(type);
          setTypeModalOpen(false);
        }}
      />

      <WeaponNameEditModal
        open={nameModalOpen}
        initialName={el.name || ''}
        onClose={() => setNameModalOpen(false)}
        onSave={(name) => {
          updateElement({ name });
          setNameModalOpen(false);
        }}
      />

      <ImageSelectModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onSelectImage={handleImageSelected}
      />

      {supportsVideo ? (
        <ImageSelectModal
          open={videoSelectOpen}
          onClose={() => setVideoSelectOpen(false)}
          onSelectImage={handleVideoSelected}
        />
      ) : null}

      <WeaponStatEditModal
        open={statEditKey != null}
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
        open={statSelectOpen}
        weaponType={weaponType}
        stats={stats}
        onClose={() => setStatSelectOpen(false)}
        onSave={(nextStats) => {
          handleSaveStatsSelection(nextStats);
          setStatSelectOpen(false);
        }}
      />

      {supportsVideo ? (
        <WeaponVideoModal
          open={videoModalOpen}
          url={videoSrc}
          onClose={() => setVideoModalOpen(false)}
        />
      ) : null}
    </>
  );

  return (
    <WeaponBlock
      mode="edit"
      attributes={attributes as React.HTMLAttributes<HTMLDivElement>}
      content={content}
    />
  );
}

export default WeaponCard;
