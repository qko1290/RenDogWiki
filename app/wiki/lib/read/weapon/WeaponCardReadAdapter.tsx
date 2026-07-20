'use client';

import React, {
  useMemo,
  useState,
} from 'react';

import SmartImage from '@/components/common/SmartImage';
import {
  WeaponCardRenderer,
  WikiBlockFrame,
} from '@/components/wiki-render';
import {
  normalizeWeaponType,
  supportsWeaponVideo,
  WEAPON_TYPES_META,
} from '@/components/wiki-render/weapon/weaponMeta';
import {
  getWeaponLevelLabelsFromStats,
} from '@/components/wiki-render/weapon/weaponLevelUtils';
import type {
  WeaponImageRenderArgs,
} from '@/components/wiki-render/weapon/types';
import {
  useWeaponLevelSelection,
} from '@/components/wiki-render/weapon/useWeaponLevelSelection';

import {
  cdn,
  withVersion,
} from '@lib/cdn';

import WeaponVideoModal from './WeaponVideoModal';

type WeaponCardReadAdapterProps = {
  node: any;
  keyProp?: React.Key;
  isDarkMode?: boolean;
  isMobile?: boolean;
};

export default function WeaponCardReadAdapter({
  node,
  keyProp,
  isDarkMode = false,
  isMobile = false,
}: WeaponCardReadAdapterProps) {
  const stats: any[] =
    Array.isArray(
      node.stats,
    )
      ? node.stats
      : [];

  const enabledStats =
    stats.filter(
      (stat) =>
        stat &&
        stat.enabled,
    );

  const levelLabels =
    useMemo(
      () =>
        getWeaponLevelLabelsFromStats(
          enabledStats,
        ),
      [enabledStats],
    );

  const {
    selectedLevelIndex,
    setSelectedLevelIndex,
  } = useWeaponLevelSelection(
    levelLabels,
  );

  const [
    showVideo,
    setShowVideo,
  ] = useState(false);

  const weaponType =
    normalizeWeaponType(
      node.weaponType,
    );

  const meta =
    WEAPON_TYPES_META[
      weaponType
    ] ??
    WEAPON_TYPES_META.epic;

  const name =
    String(
      node.name ?? '',
    ).trim() ||
    '무기 이름 없음';

  const versionBase =
    node.imageUpdatedAt ||
    node.imageVersion ||
    node.videoUpdatedAt ||
    node.videoVersion ||
    node.updatedAt ||
    node.version;

  const rawImage =
    node.imageUrl ||
    node.image ||
    '';

  const imageSrc =
    rawImage
      ? withVersion(
          cdn(rawImage),
          versionBase,
        )
      : '';

  const supportsVideo =
    supportsWeaponVideo(
      weaponType,
    );

  const rawVideo =
    supportsVideo
      ? node.videoUrl || ''
      : '';

  const videoSrc =
    rawVideo
      ? withVersion(
          cdn(rawVideo),
          versionBase,
        )
      : '';

  const content = (
    <>
      <WeaponCardRenderer
        mode="read"
        weapon={{
          ...node,
          weaponType,
          name,
          imageUrl:
            rawImage,
          videoUrl:
            rawVideo,
        }}
        meta={meta}
        stats={enabledStats}
        imageSrc={imageSrc}
        videoSrc={videoSrc}
        supportsVideo={
          supportsVideo
        }
        isDarkMode={
          isDarkMode
        }
        isMobile={isMobile}
        selectedLevelIndex={
          selectedLevelIndex
        }
        levelLabels={
          levelLabels
        }
        onLevelChange={
          setSelectedLevelIndex
        }
        onVideoClick={() => {
          if (videoSrc) {
            setShowVideo(
              true,
            );
          }
        }}
        renderImage={({
          src,
          alt,
          width,
          height,
          style,
        }: WeaponImageRenderArgs) => (
          <SmartImage
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes=
              "(max-width: 768px) 220px, 260px"
            loading="lazy"
            decoding="async"
            rounded={10}
            style={{
              ...style,
              background:
                'transparent',
              imageRendering:
                'pixelated',
            }}
          />
        )}
      />

      {supportsVideo &&
      videoSrc ? (
        <WeaponVideoModal
          open={showVideo}
          url={videoSrc}
          onClose={() =>
            setShowVideo(
              false,
            )
          }
        />
      ) : null}
    </>
  );

  return (
    <WikiBlockFrame
      key={keyProp}
      mode="read"
      editClassName=
        "wiki-weapon-card-edit"
      readClassName=
        "wiki-weapon-card-read"
      content={content}
    />
  );
}