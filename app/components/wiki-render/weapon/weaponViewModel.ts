import type React from 'react';
import type { WeaponCardData, WeaponMetaLike, WeaponStatLike } from './types';

export const VIDEOLESS_WEAPON_TYPES = new Set([
  'boss',
  'mini-boss',
  'monster',
  'rune',
  'fishing-rod',
  'armor',
]);

export function weaponSupportsVideo(weaponType?: string | null) {
  return !VIDEOLESS_WEAPON_TYPES.has(String(weaponType ?? '').trim());
}

export function isTranscendWeapon(
  weaponType?: string | null,
  meta?: WeaponMetaLike | null,
) {
  return (
    (meta?.label ? meta.label.toUpperCase().startsWith('TRANSCEND') : false) ||
    String(weaponType || '').toLowerCase().startsWith('transcend')
  );
}

export function isSpiritWeapon(weaponType?: string | null) {
  return String(weaponType ?? '') === 'spirit';
}

export function shortLevelLabel(label: string): string {
  const raw = String(label ?? '').trim();

  if (!raw) return '?';

  const upper = raw.toUpperCase();

  if (upper === 'MAX' || upper === 'M') return 'M';

  const numMatch = raw.match(/\d+/);

  if (numMatch) return numMatch[0];

  return raw[0] ?? '?';
}

export function normalizeWeaponLevelLabels(
  levelLabels?: string[] | null,
  spiritLayout?: boolean,
) {
  const labels = Array.isArray(levelLabels)
    ? levelLabels.map((label) => String(label ?? '')).filter(Boolean)
    : [];

  if (spiritLayout && labels.length >= 15) {
    return labels.map((label, index) =>
      index === labels.length - 1 ? 'MAX' : label,
    );
  }

  return labels;
}

export function isMaxLevelLabel(label?: string | null, short?: string | null) {
  const up = String(label ?? '').toUpperCase();
  const s = String(short ?? '').toUpperCase();

  return up === 'MAX' || up === 'M' || s === 'MAX' || s === 'M';
}

export function getWeaponStatDisplay(
  stat: WeaponStatLike,
  selectedLevelIndex: number | null | undefined,
) {
  const values = Array.isArray(stat.values) ? stat.values : null;
  const levels = Array.isArray(stat.levels) ? stat.levels : null;

  const idx =
    typeof selectedLevelIndex === 'number' &&
    Number.isFinite(selectedLevelIndex) &&
    selectedLevelIndex >= 0
      ? selectedLevelIndex
      : null;

  let raw: unknown = stat.summary ?? stat.value ?? '';

  if (idx != null) {
    if (values && idx < values.length) {
      raw = values[idx] ?? stat.summary ?? stat.value ?? '';
    } else if (levels && idx < levels.length) {
      const level = levels[idx] as any;

      if (level && typeof level === 'object') {
        raw = level.value ?? level.summary ?? stat.summary ?? stat.value ?? '';
      } else {
        raw = level ?? stat.summary ?? stat.value ?? '';
      }
    }
  }

  // 단일 단계 타입 방어:
  // weapon / limited / hidden / block 등은 값이 levels[0].value에만 있을 수 있음
  if ((raw == null || raw === '') && levels && levels.length > 0) {
    const firstLevel = levels[0] as any;

    if (firstLevel && typeof firstLevel === 'object') {
      raw = firstLevel.value ?? firstLevel.summary ?? raw;
    } else {
      raw = firstLevel ?? raw;
    }
  }

  return {
    value: String(raw ?? ''),
    unit: stat.unit ? String(stat.unit) : '',
  };
}

export function getEnabledWeaponStats(stats?: WeaponStatLike[] | null) {
  return Array.isArray(stats)
    ? stats.filter((stat) => stat.enabled !== false)
    : [];
}

export function createWeaponFrameStyles({
  meta,
  isSpirit,
  isTranscend,
}: {
  meta: WeaponMetaLike;
  isSpirit: boolean;
  isTranscend: boolean;
}) {
  const headerBg = meta.headerBg || '#7c3aed';
  const border = meta.border || '#a855f7';

  const transcendFrameStyle: React.CSSProperties = {
    padding: 2,
    borderRadius: 20,
    background: `linear-gradient(135deg, ${headerBg} 0%, ${border} 45%, #ffffff 60%, ${headerBg} 100%)`,
    boxShadow: `0 0 0 1px rgba(255,255,255,.18) inset,
      0 18px 55px rgba(0,0,0,.55),
      0 0 28px rgba(255,255,255,.12),
      0 0 40px ${headerBg}55`,
  };

  const transcendInnerGlowStyle: React.CSSProperties = {
    borderRadius: 18,
    overflow: 'hidden',
    background: `radial-gradient(circle at 20% 0%, ${border}22, transparent 55%),
      radial-gradient(circle at 100% 0%, ${headerBg}2a, transparent 60%),
      radial-gradient(circle at 50% 110%, rgba(255,255,255,.08), transparent 50%),
      #020617`,
    boxShadow: '0 0 0 1px rgba(255,255,255,.10) inset',
    position: 'relative',
  };

  const spiritFrameStyle: React.CSSProperties = {
    padding: 2,
    borderRadius: 20,
    background:
      'linear-gradient(135deg, #021011 0%, #06383a 28%, #15c8bc 48%, #071112 62%, #0b1f2a 100%)',
    boxShadow:
      '0 0 0 1px rgba(29, 211, 199, .22) inset, 0 20px 55px rgba(0,0,0,.72), 0 0 34px rgba(20, 184, 166, .24), 0 0 80px rgba(8, 47, 73, .35)',
  };

  const spiritInnerGlowStyle: React.CSSProperties = {
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    background:
      'radial-gradient(circle at 18% 5%, rgba(29, 211, 199, .18), transparent 34%), radial-gradient(circle at 88% 12%, rgba(56, 189, 248, .10), transparent 32%), radial-gradient(circle at 50% 115%, rgba(4, 120, 87, .24), transparent 48%), linear-gradient(180deg, #02090a 0%, #041314 48%, #010506 100%)',
    boxShadow: '0 0 0 1px rgba(148, 255, 246, .10) inset',
  };

  const spiritOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity: 0.9,
    backgroundImage:
      'radial-gradient(circle at 16% 22%, rgba(125, 255, 239, .22) 0 1px, transparent 2px), radial-gradient(circle at 78% 32%, rgba(56, 189, 248, .20) 0 1px, transparent 2px), radial-gradient(circle at 42% 68%, rgba(45, 212, 191, .16) 0 1px, transparent 2px), linear-gradient(135deg, transparent 0%, rgba(20, 184, 166, .08) 44%, transparent 62%)',
    backgroundSize: '72px 72px, 96px 96px, 120px 120px, 100% 100%',
    mixBlendMode: 'screen',
    zIndex: 0,
  };

  return {
    frameStyle: isSpirit
      ? spiritFrameStyle
      : isTranscend
        ? transcendFrameStyle
        : undefined,
    innerGlowStyle: isSpirit
      ? spiritInnerGlowStyle
      : isTranscend
        ? transcendInnerGlowStyle
        : undefined,
    spiritOverlayStyle,
  };
}

export function getWeaponCardPalette({
  isDarkMode,
  isSpirit,
}: {
  isDarkMode?: boolean;
  isSpirit?: boolean;
}) {
  return {
    cardBg: isSpirit
      ? '#02090a'
      : isDarkMode
        ? 'var(--surface-elevated)'
        : '#020617',
    cardShadow: isDarkMode
      ? 'var(--shadow-lg)'
      : '0 18px 45px rgba(0,0,0,.45)',
    imageEmptyColor: isDarkMode ? 'var(--muted-2)' : '#6b7280',
    statEmptyBg: isDarkMode ? 'rgba(15,23,42,.82)' : 'rgba(15,23,42,.75)',
    statRowBorder: isSpirit
      ? '1px solid rgba(45, 212, 191, .085)'
      : isDarkMode
        ? '1px solid var(--border)'
        : '1px solid #111827',
    statRowBg: isSpirit
      ? 'linear-gradient(90deg, rgba(2, 18, 20, .82), rgba(4, 32, 35, .72))'
      : isDarkMode
        ? 'linear-gradient(90deg, rgba(15,23,42,.82), rgba(17,24,39,.96))'
        : 'linear-gradient(90deg, rgba(15,23,42,.95), rgba(15,23,42,.85))',
    statLabelColor: isDarkMode ? 'var(--muted)' : '#9ca3af',
    statValueColor: isSpirit
      ? '#e6fffb'
      : isDarkMode
        ? 'var(--foreground)'
        : '#e5e7eb',
    disabledButtonBg: isDarkMode ? 'var(--surface)' : '#111827',
    disabledButtonColor: isDarkMode ? 'var(--muted-2)' : '#6b7280',
  };
}

export function normalizeWeaponData(weapon?: WeaponCardData | null) {
  return {
    weaponType: String(weapon?.weaponType ?? 'epic'),
    name: String(weapon?.name ?? '').trim(),
    imageUrl: String(weapon?.imageUrl ?? '').trim(),
    videoUrl: String(weapon?.videoUrl ?? '').trim(),
  };
}
