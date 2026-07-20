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
  WEAPON_TYPES_META,
} from '@/components/wiki-render/weapon/weaponMeta';
import {
  resolveWeaponNode,
} from '@/components/wiki-render/weapon/weaponNodeUtils';
import {
  getWeaponLevelLabelsFromStats,
  useWeaponLevelSelection,
} from '@/components/wiki-render/weapon/weaponLevelSelection';
import type {
  WeaponImageRenderArgs,
} from '@/components/wiki-render/weapon/types';

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

  const resolvedWeapon =
    resolveWeaponNode(node);

  const {
    weaponType,
    rawImage,
    rawVideo,
    imageVersion,
    videoVersion,
    supportsVideo,
  } = resolvedWeapon;

  const meta =
    WEAPON_TYPES_META[
      weaponType
    ] ??
    WEAPON_TYPES_META.epic;

  const name =
    resolvedWeapon.rawName ||
    '무기 이름 없음';

  const imageSrc =
    rawImage
      ? withVersion(
          cdn(rawImage),
          imageVersion,
        )
      : '';

  const videoSrc =
    rawVideo
      ? withVersion(
          cdn(rawVideo),
          videoVersion,
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
