import {
  normalizeWeaponType,
  supportsWeaponVideo,
} from './weaponMeta';
import type {
  WeaponType,
} from './weaponMeta';

type WeaponNodeLike =
  | Record<string, unknown>
  | null
  | undefined;

export type ResolvedWeaponNode = {
  weaponType: WeaponType;
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

export function resolveWeaponNode(
  node: WeaponNodeLike,
): ResolvedWeaponNode {
  const weaponType =
    normalizeWeaponType(
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