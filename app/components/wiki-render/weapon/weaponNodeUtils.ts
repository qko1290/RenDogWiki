import type {
  WeaponType as SlateWeaponType,
} from '@/types/slate';

import {
  normalizeWeaponType,
  supportsWeaponVideo,
} from './weaponMeta';

type WeaponNodeLike =
  | Record<string, unknown>
  | null
  | undefined;

export type ResolvedWeaponNode = {
  weaponType: SlateWeaponType;
  rawName: string;
  rawImage: string;
  rawVideo: string;
  imageVersion:
    | string
    | number
    | undefined;
  videoVersion:
    | string
    | number
    | undefined;
  supportsVideo: boolean;
};

function resolveVersion(
  values: unknown[],
): string | number | undefined {
  for (const value of values) {
    if (
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return value;
    }
  }

  return undefined;
}

function resolveSlateWeaponType(
  value: unknown,
): SlateWeaponType {
  const normalized =
    normalizeWeaponType(value);

  /**
   * weaponMeta는 기존 데이터 호환을 위해
   * miniBoss와 mini-boss를 모두 허용한다.
   *
   * Slate 문서 타입에서는 mini-boss만 사용하므로
   * 공통 렌더링 경계에서 표기를 하나로 통일한다.
   */
  if (normalized === 'miniBoss') {
    return 'mini-boss';
  }

  return normalized as SlateWeaponType;
}

export function resolveWeaponNode(
  node: WeaponNodeLike,
): ResolvedWeaponNode {
  const weaponType =
    resolveSlateWeaponType(
      node?.weaponType,
    );

  const videoSupported =
    supportsWeaponVideo(
      weaponType,
    );

  const rawName = String(
    node?.name ?? '',
  ).trim();

  const rawImage = String(
    node?.imageUrl ??
      node?.image ??
      '',
  ).trim();

  const rawVideo = videoSupported
    ? String(
        node?.videoUrl ??
          node?.video ??
          '',
      ).trim()
    : '';

  const commonVersion =
    resolveVersion([
      node?.updatedAt,
      node?.version,
    ]);

  const imageVersion =
    resolveVersion([
      node?.imageUpdatedAt,
      node?.imageVersion,
      commonVersion,
    ]);

  const videoVersion =
    resolveVersion([
      node?.videoUpdatedAt,
      node?.videoVersion,
      commonVersion,
    ]);

  return {
    weaponType,
    rawName,
    rawImage,
    rawVideo,
    imageVersion,
    videoVersion,
    supportsVideo:
      videoSupported,
  };
}