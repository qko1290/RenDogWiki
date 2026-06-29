'use client';

import React, { useEffect, useMemo, useState } from 'react';

import SmartImage from '@/components/common/SmartImage';
import { cdn, withVersion } from '@lib/cdn';

import WeaponBlock from '@/components/wiki-render/blocks/WeaponBlock';
import WeaponCardRenderer from './WeaponCardRenderer';
import WeaponVideoModal from './WeaponVideoModal';

import {
  WEAPON_TYPES_META,
  normalizeWeaponType,
  supportsWeaponVideo,
} from './weaponMeta';

import type { WeaponImageRenderArgs } from './types';

type WeaponCardReadProps = {
  node: any;
  keyProp?: React.Key;
  isDarkMode?: boolean;
  isMobile?: boolean;
};

function getDefaultWeaponLevelIndex(levelLabels: string[]) {
  if (!levelLabels.length) return null;

  const idxMax = levelLabels.findIndex((label) => {
    const upper = String(label ?? '').trim().toUpperCase();

    return upper === 'MAX' || upper === 'M';
  });

  return idxMax >= 0 ? idxMax : levelLabels.length - 1;
}

function getWeaponLevelLabelsFromStats(enabledStats: any[]) {
  const baseStatWithLevels = enabledStats.find(
    (stat) => Array.isArray(stat?.levels) && stat.levels.length > 0,
  );

  if (!baseStatWithLevels) return [];

  return baseStatWithLevels.levels
    .map((level: any) => String(level?.levelLabel ?? level?.label ?? '').trim())
    .filter(Boolean);
}

export default function WeaponCardRead({
  node,
  keyProp,
  isDarkMode = false,
  isMobile = false,
}: WeaponCardReadProps) {
  const stats: any[] = Array.isArray(node.stats) ? node.stats : [];
  const enabledStats = stats.filter((stat) => stat && stat.enabled);

  const levelLabels = useMemo(
    () => getWeaponLevelLabelsFromStats(enabledStats),
    [enabledStats],
  );

  const levelSignature = levelLabels.join('|');

  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number | null>(
    () => getDefaultWeaponLevelIndex(levelLabels),
  );

  useEffect(() => {
    setSelectedLevelIndex(getDefaultWeaponLevelIndex(levelLabels));
  }, [levelSignature]);

  const [showVideo, setShowVideo] = useState(false);

  const weaponType = normalizeWeaponType(node.weaponType);
  const meta = WEAPON_TYPES_META[weaponType] ?? WEAPON_TYPES_META.epic;

  const name = String(node.name ?? '').trim() || '무기 이름 없음';

  const versionBase =
    node.imageUpdatedAt ||
    node.imageVersion ||
    node.videoUpdatedAt ||
    node.videoVersion ||
    node.updatedAt ||
    node.version;

  const rawImage = node.imageUrl || node.image || '';
  const imageSrc = rawImage ? withVersion(cdn(rawImage), versionBase) : '';

  const supportsVideo = supportsWeaponVideo(weaponType);
  const rawVideo = supportsVideo ? node.videoUrl || '' : '';
  const videoSrc = rawVideo ? withVersion(cdn(rawVideo), versionBase) : '';

  const content = (
    <>
      <WeaponCardRenderer
        mode="read"
        weapon={{
          ...node,
          weaponType,
          name,
          imageUrl: rawImage,
          videoUrl: rawVideo,
        }}
        meta={meta}
        stats={enabledStats}
        imageSrc={imageSrc}
        videoSrc={videoSrc}
        supportsVideo={supportsVideo}
        isDarkMode={isDarkMode}
        isMobile={isMobile}
        selectedLevelIndex={selectedLevelIndex}
        levelLabels={levelLabels}
        onLevelChange={(idx) => setSelectedLevelIndex(idx)}
        onVideoClick={() => {
          if (videoSrc) setShowVideo(true);
        }}
        renderImage={({ src, alt, width, height, style }: WeaponImageRenderArgs) => (
          <SmartImage
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes="(max-width: 768px) 220px, 260px"
            loading="lazy"
            decoding="async"
            rounded={10}
            style={{
              ...style,
              background: 'transparent',
              imageRendering: 'pixelated',
            }}
          />
        )}
      />

      {supportsVideo && videoSrc ? (
        <WeaponVideoModal
          open={showVideo}
          url={videoSrc}
          onClose={() => setShowVideo(false)}
        />
      ) : null}
    </>
  );

  return (
    <WeaponBlock
      key={keyProp}
      mode="read"
      content={content}
      compact={isMobile}
    />
  );
}