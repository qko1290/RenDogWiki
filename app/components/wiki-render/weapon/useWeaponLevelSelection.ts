'use client';

import React from 'react';

import {
  getDefaultWeaponLevelIndex,
} from './weaponLevelUtils';

type UseWeaponLevelSelectionResult = {
  selectedLevelIndex: number | null;
  setSelectedLevelIndex:
    React.Dispatch<
      React.SetStateAction<number | null>
    >;
};

export function useWeaponLevelSelection(
  levelLabels: string[],
  resetKey?: string,
): UseWeaponLevelSelectionResult {
  const levelSignature =
    levelLabels.join('|');

  const defaultLevelIndex =
    getDefaultWeaponLevelIndex(
      levelLabels,
    );

  const [
    selectedLevelIndex,
    setSelectedLevelIndex,
  ] = React.useState<number | null>(
    () => defaultLevelIndex,
  );

  React.useEffect(() => {
    setSelectedLevelIndex(
      defaultLevelIndex,
    );
  }, [
    defaultLevelIndex,
    levelSignature,
    resetKey,
  ]);

  return {
    selectedLevelIndex,
    setSelectedLevelIndex,
  };
}