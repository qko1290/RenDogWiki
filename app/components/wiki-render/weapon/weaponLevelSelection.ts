'use client';

import React from 'react';

type WeaponLevelLike = {
  levelLabel?: unknown;
  label?: unknown;
};

type WeaponStatWithLevelsLike = {
  levels?: unknown;
};

export function getDefaultWeaponLevelIndex(
  levelLabels: string[],
): number | null {
  if (levelLabels.length === 0) return null;

  const maxIndex = levelLabels.findIndex((label) => {
    const normalized = String(label ?? '').trim().toUpperCase();
    return normalized === 'MAX' || normalized === 'M';
  });

  return maxIndex >= 0 ? maxIndex : levelLabels.length - 1;
}

export function getWeaponLevelLabelsFromStats(
  stats: WeaponStatWithLevelsLike[],
): string[] {
  const statWithLevels = stats.find(
    (stat) => Array.isArray(stat?.levels) && stat.levels.length > 0,
  );

  if (!statWithLevels || !Array.isArray(statWithLevels.levels)) {
    return [];
  }

  return (statWithLevels.levels as WeaponLevelLike[])
    .map((level) =>
      String(level?.levelLabel ?? level?.label ?? '').trim(),
    )
    .filter(Boolean);
}

type UseWeaponLevelSelectionResult = {
  selectedLevelIndex: number | null;
  setSelectedLevelIndex: React.Dispatch<
    React.SetStateAction<number | null>
  >;
};

export function useWeaponLevelSelection(
  levelLabels: string[],
  resetKey?: string,
): UseWeaponLevelSelectionResult {
  const levelSignature = levelLabels.join('|');
  const defaultLevelIndex = getDefaultWeaponLevelIndex(levelLabels);

  const [selectedLevelIndex, setSelectedLevelIndex] =
    React.useState<number | null>(() => defaultLevelIndex);

  React.useEffect(() => {
    setSelectedLevelIndex(defaultLevelIndex);
  }, [defaultLevelIndex, levelSignature, resetKey]);

  return { selectedLevelIndex, setSelectedLevelIndex };
}
