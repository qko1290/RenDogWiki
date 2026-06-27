import React from 'react';
import {
  createWeaponFrameStyles,
  getEnabledWeaponStats,
  getWeaponCardPalette,
  getWeaponStatDisplay,
  isMaxLevelLabel,
  isSpiritWeapon,
  isTranscendWeapon,
  normalizeWeaponData,
  normalizeWeaponLevelLabels,
  shortLevelLabel,
} from './weaponViewModel';
import type {
  WeaponCardRendererProps,
  WeaponImageRenderArgs,
  WeaponStatLike,
} from './types';

function defaultRenderImage({
  src,
  alt,
  width,
  height,
  style,
}: WeaponImageRenderArgs) {
  return (
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
  );
}

type WeaponLevelSelectorProps = {
  levelLabels: string[];
  selectedIndex: number | null;
  onChange?: (idx: number) => void;
  compact?: boolean;
  overlay?: boolean;
  spiritLayout?: boolean;
};

function WeaponLevelSelector({
  levelLabels,
  selectedIndex,
  onChange,
  compact = false,
  overlay = false,
  spiritLayout = false,
}: WeaponLevelSelectorProps) {
  const [open, setOpen] = React.useState(false);

  if (levelLabels.length <= 1) return null;

  const displayLevelLabels =
    spiritLayout && levelLabels.length >= 15
      ? levelLabels.map((label, idx) =>
          idx === levelLabels.length - 1 ? 'MAX' : label,
        )
      : levelLabels;

  const selectedLabel =
    selectedIndex != null ? displayLevelLabels[selectedIndex] : null;
  const selectedShort = selectedLabel ? shortLevelLabel(selectedLabel) : '-';

  const isMaxLabel = (label: string | null | undefined, short: string) => {
    if (!label && !short) return false;
    const up = String(label ?? '').toUpperCase();
    return up.includes('MAX') || up === 'M' || short === 'M';
  };

  const selectedIsMax = isMaxLabel(selectedLabel, selectedShort);

  const handleSelect = (idx: number) => {
    onChange?.(idx);
    setOpen(false);
  };

  const BASE_BG = 'rgba(15,23,42,0.96)';
  const BASE_TEXT = '#e5e7eb';
  const BASE_BORDER = '1px solid rgba(148,163,184,0.95)';
  const ACTIVE_BORDER = '1px solid rgba(96,165,250,0.95)';

  const MAX_BG = '#facc15';
  const MAX_TEXT = '#111827';
  const MAX_BORDER = '1px solid #fbbf24';

  const DOT = compact ? 26 : 30;
  const DOT_FONT = compact ? 12 : 13;
  const TOP_FONT = compact ? 13 : 14;

  const DOT_SHADOW =
    '0 10px 24px rgba(15,23,42,0.22), 0 2px 6px rgba(15,23,42,0.12)';
  const DOT_SHADOW_ACTIVE =
    '0 12px 28px rgba(37,99,235,0.18), 0 2px 8px rgba(15,23,42,0.12)';

  const renderLevelButton = (fullLabel: string, idx: number) => {
    const short = shortLevelLabel(fullLabel);
    const active = selectedIndex === idx;
    const isMax = isMaxLabel(fullLabel, short);

    const bg = isMax ? MAX_BG : BASE_BG;
    const textColor = isMax ? MAX_TEXT : BASE_TEXT;
    const border = isMax ? MAX_BORDER : active ? ACTIVE_BORDER : BASE_BORDER;

    return (
      <button
        key={`${fullLabel}-${idx}`}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSelect(idx);
        }}
        style={{
          border: 'none',
          outline: 'none',
          cursor: 'pointer',
          padding: 0,
          margin: 0,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={fullLabel}
      >
        <span
          style={{
            width: DOT,
            height: DOT,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: DOT_FONT,
            fontWeight: active ? 900 : 800,
            background: bg,
            color: textColor,
            border,
            boxShadow: active ? DOT_SHADOW_ACTIVE : DOT_SHADOW,
            transform: active ? 'translateY(-1px)' : 'translateY(0)',
            transition:
              'transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
          }}
        >
          {short}
        </span>
      </button>
    );
  };

  return (
    <div
      style={{
        position: 'relative',
        marginLeft: overlay ? 0 : 10,
        alignSelf: 'flex-start',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          border: 'none',
          outline: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: 0,
          background: 'transparent',
          color: BASE_TEXT,
          fontSize: TOP_FONT,
          fontWeight: 650,
          lineHeight: 1,
        }}
      >
        <span
          style={{
            width: DOT,
            height: DOT,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: DOT_FONT,
            fontWeight: 800,
            background: selectedIsMax ? MAX_BG : BASE_BG,
            color: selectedIsMax ? MAX_TEXT : BASE_TEXT,
            border: selectedIsMax ? MAX_BORDER : BASE_BORDER,
            boxShadow: DOT_SHADOW,
          }}
        >
          {selectedShort}
        </span>

        <span
          style={{
            fontSize: 12,
            opacity: 0.8,
            transform: open ? 'translateY(-1px)' : 'translateY(0)',
            transition: 'transform 0.12s ease',
            userSelect: 'none',
          }}
        >
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            top: compact ? 34 : 38,
            right: 0,
            zIndex: 50,
            padding: compact ? 8 : 10,
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.35)',
            background: 'rgba(2,6,23,0.98)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {spiritLayout ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: compact ? 8 : 10,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                {displayLevelLabels
                  .slice(0, 9)
                  .map((fullLabel, idx) => renderLevelButton(fullLabel, idx))}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                {displayLevelLabels
                  .slice(9)
                  .map((fullLabel, localIdx) =>
                    renderLevelButton(fullLabel, localIdx + 9),
                  )}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'center',
              }}
            >
              {displayLevelLabels.map((fullLabel, idx) =>
                renderLevelButton(fullLabel, idx),
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WeaponStatRow({
  stat,
  selectedLevelIndex,
  styleTokens,
  isSpirit,
  onClick,
}: {
  stat: WeaponStatLike;
  selectedLevelIndex: number | null;
  styleTokens: ReturnType<typeof getWeaponCardPalette>;
  isSpirit: boolean;
  onClick?: (stat: WeaponStatLike, event: React.MouseEvent) => void;
}) {
  const { value, unit } = getWeaponStatDisplay(stat, selectedLevelIndex);

  return (
    <button
      data-wiki-part="weapon-stat-row"
      type="button"
      key={stat.key || stat.label}
      onClick={
        onClick
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick(stat, e);
            }
          : undefined
      }
      style={{
        width: '100%',
        borderRadius: 10,
        padding: '6px 8px',
        border: styleTokens.statRowBorder,
        background: styleTokens.statRowBg,
        boxShadow: isSpirit
          ? '0 0 18px rgba(20, 184, 166, .035) inset'
          : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
      }}
      title={onClick ? '클릭해서 강화별 상세 정보 보기/편집' : undefined}
    >
      <span
        style={{
          fontSize: 12,
          color: styleTokens.statLabelColor,
          fontWeight: 500,
        }}
      >
        {stat.label}
      </span>

      <span
        style={{
          fontSize: 13,
          color: styleTokens.statValueColor,
          fontWeight: 600,
        }}
      >
        {value || '-'}
        {unit ? ` ${unit}` : ''}
      </span>
    </button>
  );
}

export default function WeaponCardRenderer({
  mode,
  weapon,
  meta,
  stats,
  imageSrc,
  videoSrc,
  supportsVideo = true,
  isDarkMode = false,
  isMobile = false,
  selectedLevelIndex = null,
  levelLabels = [],
  onLevelChange,
  onTypeClick,
  onNameClick,
  onImageClick,
  onStatClick,
  onVideoClick,
  onVideoSettingClick,
  onStatSettingClick,
  onContextMenu,
  renderImage = defaultRenderImage,
  renderExtraControls,
  children,
}: WeaponCardRendererProps) {
  const normalized = normalizeWeaponData(weapon);
  const weaponType = normalized.weaponType;
  const isSpirit = isSpiritWeapon(weaponType);
  const isTranscend = isTranscendWeapon(weaponType, meta);
  const enabledStats = getEnabledWeaponStats(stats);

  const cardWidth = isMobile ? 238 : 260;

  const frame = createWeaponFrameStyles({
    meta,
    isSpirit,
    isTranscend,
  });

  const colors = getWeaponCardPalette({
    isDarkMode,
    isSpirit,
  });

  const label = meta.label || weaponType || 'WEAPON';
  const name = normalized.name || '새 무기 이름';
  const safeImageSrc = String(imageSrc ?? normalized.imageUrl ?? '').trim();
  const safeVideoSrc = String(videoSrc ?? normalized.videoUrl ?? '').trim();
  const canEdit = mode === 'edit';

  return (
    <>
      <div
        data-wiki-card-wrap={mode === 'read' ? 'weapon-read' : 'weapon-edit'}
        contentEditable={false}
        suppressContentEditableWarning
        onContextMenu={onContextMenu}
        style={{
          margin: '14px 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: isMobile ? 0 : 10,
          flexWrap: 'nowrap',
          position: isMobile ? 'relative' : undefined,
          width: isMobile ? `${cardWidth}px` : undefined,
          marginLeft: isMobile ? 'auto' : undefined,
          marginRight: isMobile ? 'auto' : undefined,
        }}
      >
        <div
          style={
            isSpirit || isTranscend
              ? frame.frameStyle
              : {
                  borderRadius: 18,
                  border: `2px solid ${meta.border || '#a855f7'}`,
                  overflow: 'hidden',
                  background: '#020617',
                  boxShadow: '0 16px 35px rgba(0,0,0,.45)',
                }
          }
        >
          <div
            data-wiki-card={mode === 'read' ? 'weapon-read' : 'weapon-edit'}
            style={{
              width: cardWidth,
              borderRadius: 18,
              overflow: 'hidden',
              background: colors.cardBg,
              boxShadow: colors.cardShadow,
              fontFamily: 'inherit',
              paddingTop: 8,
              ...(frame.innerGlowStyle || null),
            }}
          >
            {isSpirit ? (
              <div style={frame.spiritOverlayStyle} aria-hidden="true" />
            ) : null}

            <div style={{ position: 'relative', zIndex: 1 }}>
              {renderExtraControls?.()}

              <button
                data-wiki-part="weapon-type-bar"
                type="button"
                onClick={
                  onTypeClick
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onTypeClick(e);
                      }
                    : undefined
                }
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: isSpirit
                    ? 'linear-gradient(90deg, #020617 0%, #06383a 35%, #0f766e 55%, #020617 100%)'
                    : meta.headerBg || '#7c3aed',
                  color: isSpirit ? '#d9fffb' : '#f9fafb',
                  textShadow: isSpirit
                    ? '0 0 10px rgba(45, 212, 191, .65)'
                    : undefined,
                  padding: '6px 0',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textAlign: 'center',
                  cursor: onTypeClick ? 'pointer' : 'default',
                }}
              >
                {label}
              </button>

              <div
                data-wiki-part="weapon-name"
                onClick={
                  onNameClick
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onNameClick(e);
                      }
                    : undefined
                }
                style={{
                  padding: '10px 14px',
                  background: isSpirit
                    ? 'linear-gradient(180deg, rgba(2, 6, 23, .98), rgba(3, 24, 27, .96))'
                    : '#020617',
                  color: isSpirit ? '#e6fffb' : '#e5e7eb',
                  fontSize: 18,
                  fontWeight: 700,
                  textAlign: 'center',
                  borderBottom: isSpirit
                    ? '1px solid rgba(45, 212, 191, .22)'
                    : '1px solid #111827',
                  cursor: onNameClick ? 'pointer' : 'default',
                  userSelect: 'none',
                  textShadow: isSpirit
                    ? '0 0 12px rgba(20, 184, 166, .35)'
                    : undefined,
                }}
              >
                {name}
              </div>

              <div
                data-wiki-part="weapon-image"
                onClick={
                  onImageClick
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onImageClick(e);
                      }
                    : undefined
                }
                style={{
                  background: isSpirit
                    ? 'radial-gradient(circle at 18% 12%, rgba(29, 211, 199, .20), transparent 38%), radial-gradient(circle at 78% 22%, rgba(14, 165, 233, .12), transparent 42%), radial-gradient(circle at 50% 95%, rgba(6, 78, 59, .26), transparent 48%), #010607'
                    : 'radial-gradient(circle at 20% 0%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at 100% 0%, rgba(129,140,248,0.22), transparent 55%), #020617',
                  height: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: onImageClick ? 'pointer' : 'default',
                }}
              >
                {safeImageSrc ? (
                  renderImage({
                    src: safeImageSrc,
                    alt: name,
                    width: 160,
                    height: 96,
                    style: {
                      maxWidth: '80%',
                      maxHeight: '80%',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.55))',
                      display: 'block',
                    },
                  })
                ) : (
                  <span
                    style={{
                      color: colors.imageEmptyColor,
                      fontSize: 14,
                    }}
                  >
                    이미지 없음
                  </span>
                )}
              </div>

              <div
                data-wiki-part="weapon-stats"
                style={{
                  padding: '8px 10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {enabledStats.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.imageEmptyColor,
                      padding: '6px 8px',
                      borderRadius: 10,
                      background: colors.statEmptyBg,
                    }}
                  >
                    표시할 정보가 없습니다. (정보 설정 버튼으로 추가)
                  </div>
                ) : null}

                {enabledStats.map((stat) => (
                  <WeaponStatRow
                    key={stat.key || stat.label}
                    stat={stat}
                    selectedLevelIndex={selectedLevelIndex}
                    styleTokens={colors}
                    isSpirit={isSpirit}
                    onClick={onStatClick}
                  />
                ))}
              </div>

              {supportsVideo ? (
                <div
                  data-wiki-part="weapon-video-actions"
                  style={{
                    padding: '8px 10px 10px',
                    display: 'flex',
                    gap: mode === 'edit' ? 8 : 0,
                    justifyContent: mode === 'edit' ? 'stretch' : 'center',
                  }}
                >
                  <button
                    data-wiki-part="weapon-video-button"
                    type="button"
                    disabled={!safeVideoSrc}
                    onClick={
                      onVideoClick
                        ? (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onVideoClick(e);
                          }
                        : undefined
                    }
                    style={{
                      padding: '8px 10px',
                      borderRadius: 999,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      background: safeVideoSrc
                        ? isSpirit
                          ? 'linear-gradient(90deg, #064e3b, #0f766e, #155e75)'
                          : 'linear-gradient(90deg,#1d4ed8,#3b82f6)'
                        : colors.disabledButtonBg,
                      color: safeVideoSrc ? '#f9fafb' : colors.disabledButtonColor,
                      cursor: safeVideoSrc && onVideoClick ? 'pointer' : 'default',
                      flex: mode === 'edit' ? 1 : undefined,
                      minWidth: mode === 'edit' ? undefined : 160,
                      textAlign: 'center',
                      boxShadow: safeVideoSrc
                        ? isSpirit
                          ? '0 12px 34px rgba(20,184,166,.42), 0 0 18px rgba(45,212,191,.22)'
                          : '0 12px 30px rgba(37,99,235,0.7)'
                        : 'none',
                    }}
                  >
                    스킬 사용 영상
                  </button>

                  {mode === 'edit' && onVideoSettingClick ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onVideoSettingClick(e);
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 999,
                        border: '1px solid #334155',
                        background: '#020617',
                        color: '#e5e7eb',
                        fontSize: 12,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      영상 설정
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {levelLabels.length > 1 && !isMobile ? (
          <WeaponLevelSelector
            levelLabels={levelLabels}
            selectedIndex={selectedLevelIndex}
            onChange={onLevelChange}
            spiritLayout={isSpirit}
          />
        ) : null}

        {mode === 'edit' && onStatSettingClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStatSettingClick(e);
            }}
            style={{
              alignSelf: 'flex-start',
              marginTop: 8,
              fontSize: 11,
              borderRadius: 999,
              padding: '4px 10px',
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
        ) : null}
      </div>

      {children}
    </>
  );
}
