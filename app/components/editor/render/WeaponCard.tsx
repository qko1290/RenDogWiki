// components/editor/render/WeaponCard.tsx
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
} from './weaponStatUtils';
import {
  WeaponTypeSelectModal,
  WeaponNameEditModal,
  WeaponStatEditModal,
  WeaponStatSelectModal,
  WeaponVideoModal,
} from './WeaponModals';
import WeaponBlock from '@/components/wiki-render/blocks/WeaponBlock';

// Element.tsx ?먯꽌 ?섍꺼二쇰뒗 ?ㅼ젣 props 紐⑥뼇?濡??뺤쓽
export interface WeaponCardProps {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: WeaponCardElement;
  editor: any;
}

export function WeaponCard(props: WeaponCardProps) {
  const { attributes, children, element, editor } = props;
  const el = element as WeaponCardElement;
  const path = ReactEditor.findPath(editor, element);
  const isReadOnly = ReactEditor.isReadOnly(editor);

  const weaponType: WeaponType = el.weaponType || 'epic';
  const VIDEOLESS_TYPES = new Set<WeaponType>([
    'boss',
    'mini-boss',
    'monster',
    'rune',
    'fishing-rod',
    'armor',
  ]);
  const supportsVideo = !VIDEOLESS_TYPES.has(weaponType);
  const meta = WEAPON_TYPES_META[weaponType];

  // ??TRANSCEND 移대뱶留??붾젮?섍쾶 留뚮뱾湲??꾪븳 ?뚮옒洹?
  const isTranscend =
    (meta?.label ? meta.label.toUpperCase().startsWith('TRANSCEND') : false) ||
    String(weaponType || '').toLowerCase().startsWith('transcend');

  const isSpirit = weaponType === 'spirit';

  // ???됱긽 -> rgba (WeaponCard.tsx?먮뒗 ?놁쑝???ш린?쒕쭔 濡쒖뺄濡?
  const hexToRgba = (hex: string, alpha: number) => {
    const h = (hex || '').replace('#', '').trim();
    const a = Math.max(0, Math.min(1, alpha));
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return `rgba(255,255,255,${a})`;
  };

  // ??珥덉썡 ?꾨젅??湲濡쒖슦/?ㅼ씤????媛믩뱾
  const tBorder = meta?.border || '#a855f7';
  const tHeader = meta?.headerBg || '#7c3aed';

  const transcendFrameStyle: React.CSSProperties = {
    padding: 2,
    borderRadius: 20,
    background: `linear-gradient(135deg, ${meta.headerBg} 0%, ${meta.border} 45%, #ffffff 60%, ${meta.headerBg} 100%)`,
    boxShadow:
      `0 0 0 1px rgba(255,255,255,.18) inset,
      0 18px 55px rgba(0,0,0,.55),
      0 0 28px rgba(255,255,255,.12),
      0 0 40px ${meta.headerBg}55`,
  };

  const transcendInnerGlowStyle: React.CSSProperties = {
    borderRadius: 18,
    overflow: 'hidden',
    background:
      `radial-gradient(circle at 20% 0%, ${meta.border}22, transparent 55%),
      radial-gradient(circle at 100% 0%, ${meta.headerBg}2a, transparent 60%),
      radial-gradient(circle at 50% 110%, rgba(255,255,255,.08), transparent 50%),
      #020617`,
    boxShadow: `0 0 0 1px rgba(255,255,255,.10) inset`,
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

  const stats = ensureWeaponStats(el.stats, weaponType);
  const visibleStats = stats.filter((s) => s.enabled);

  const [typeModalOpen, setTypeModalOpen] = React.useState(false);
  const [nameModalOpen, setNameModalOpen] = React.useState(false);
  const [imageModalOpen, setImageModalOpen] = React.useState(false);
  const [videoSelectOpen, setVideoSelectOpen] = React.useState(false);
  const [videoModalOpen, setVideoModalOpen] = React.useState(false);
  const [statEditKey, setStatEditKey] =
    React.useState<WeaponStatKey | null>(null);
  const [statSelectOpen, setStatSelectOpen] = React.useState(false);

  // ???고겢由???젣 硫붾돱 ?꾩튂
  const [contextMenuPos, setContextMenuPos] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const updateElement = (patch: Partial<WeaponCardElement>) => {
    Transforms.setNodes<WeaponCardElement>(editor, patch, { at: path });
  };

  const handleWeaponTypeChange = (next: WeaponType) => {
    if (next === weaponType) return;

    const nextStats = normalizeStatsForWeaponType(stats, next);

    updateElement({
      weaponType: next,
      stats: nextStats,

      // ??BOSS / MINI BOSS / MONSTER???곸긽 ?먯껜媛 ?놁쑝??湲곗〈 媛믩룄 ?쒓굅
      ...(VIDEOLESS_TYPES.has(next) ? { videoUrl: null } : {}),
    });

    // (?좏깮) ?뱀떆 ?대젮?덈뜕 紐⑤떖???덉쑝硫??レ븘二쇨린
    if (VIDEOLESS_TYPES.has(next)) {
      setVideoSelectOpen(false);
      setVideoModalOpen(false);
    }
  };

  const handleSaveStat = (updated: WeaponStatConfig) => {
    const nextStats = stats.map((s) =>
      s.key === updated.key ? updated : s,
    );
    updateElement({ stats: nextStats });
  };

  const handleSaveStatsSelection = (nextStats: WeaponStatConfig[]) => {
    updateElement({
      stats: normalizeStatsForWeaponType(nextStats, weaponType),
    });
  };

  const handleImageSelected = (url: string) => {
    updateElement({ imageUrl: url });
    setImageModalOpen(false);
  };

  const handleVideoSelected = (url: string) => {
    if (!supportsVideo) return; // ??boss/mini-boss/monster 諛⑹뼱
    updateElement({ videoUrl: url });
    setVideoSelectOpen(false);
  };

  const cardWidth = 260;

  const videoSrc =
    supportsVideo && el.videoUrl
      ? (el.videoUrl.startsWith('http') ? toProxyUrl(el.videoUrl) : el.videoUrl)
      : '';

  const imageSrc =
    el.imageUrl && el.imageUrl.startsWith('http')
      ? toProxyUrl(el.imageUrl)
      : el.imageUrl || '';

  // ?먮뵒??紐⑤뱶?먯꽌留?蹂댁씠???ㅼ젙 踰꾪듉??
  const showConfigButtons = !isReadOnly;

  const content = (
    <>

      {/* ??臾닿린 移대뱶 + ?뺣낫 ?ㅼ젙 踰꾪듉??以묒븰 ?뺣젹 */}
      <div
        contentEditable={false}
        style={{
          margin: '14px 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 10,
        }}
        onContextMenu={(e) => {
          // ???쎄린 ?꾩슜???꾨땺 ?뚮쭔 ??젣 而⑦뀓?ㅽ듃 硫붾돱
          if (isReadOnly) return;
          e.preventDefault();
          e.stopPropagation();
          setContextMenuPos({ x: e.clientX, y: e.clientY });
        }}
      >
        {/* 移대뱶 蹂몄껜 */}
        <div
          style={
            isSpirit
              ? spiritFrameStyle
              : isTranscend
                ? transcendFrameStyle
                : {
                    borderRadius: 18,
                    border: `2px solid ${meta.border}`,
                    overflow: 'hidden',
                    background: '#020617',
                    boxShadow: '0 16px 35px rgba(0,0,0,.45)',
                  }
          }
        >
          <div
            style={
              isSpirit
                ? {
                    width: cardWidth,
                    fontFamily: 'inherit',
                    paddingTop: 8,
                    ...spiritInnerGlowStyle,
                  }
                : isTranscend
                  ? {
                      width: cardWidth,
                      fontFamily: 'inherit',
                      paddingTop: 8,
                      ...transcendInnerGlowStyle,
                    }
                  : {
                      width: cardWidth,
                      borderRadius: 18,
                      overflow: 'hidden',
                      background: '#020617',
                      boxShadow: '0 18px 45px rgba(0,0,0,.45)',
                      fontFamily: 'inherit',
                      paddingTop: 8,
                    }
            }
          >
            {isSpirit && (
              <div style={spiritOverlayStyle} contentEditable={false} />
            )}

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* ?곷떒 ???諛?*/}
              <button
                type="button"
                onClick={() => !isReadOnly && setTypeModalOpen(true)}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: isSpirit
                    ? 'linear-gradient(90deg, #020617 0%, #06383a 35%, #0f766e 55%, #020617 100%)'
                    : meta.headerBg,
                  color: isSpirit ? '#d9fffb' : '#f9fafb',
                  textShadow: isSpirit
                    ? '0 0 10px rgba(45, 212, 191, .65)'
                    : undefined,
                  padding: '6px 0',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textAlign: 'center',
                  cursor: isReadOnly ? 'default' : 'pointer',
                }}
              >
                {meta.label}
              </button>

              {/* 臾닿린 ?대쫫 */}
              <div
                onClick={() => !isReadOnly && setNameModalOpen(true)}
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
                  cursor: isReadOnly ? 'default' : 'pointer',
                  userSelect: 'none',
                  textShadow: isSpirit
                    ? '0 0 12px rgba(20, 184, 166, .35)'
                    : undefined,
                }}
              >
                {el.name || '??臾닿린 ?대쫫'}
              </div>

              {/* ?대?吏 ?곸뿭 */}
              <div
                onClick={() => !isReadOnly && setImageModalOpen(true)}
                style={{
                  background: isSpirit
                    ? 'radial-gradient(circle at 18% 12%, rgba(29, 211, 199, .20), transparent 38%), radial-gradient(circle at 78% 22%, rgba(14, 165, 233, .12), transparent 42%), radial-gradient(circle at 50% 95%, rgba(6, 78, 59, .26), transparent 48%), #010607'
                    : 'radial-gradient(circle at 20% 0%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at 100% 0%, rgba(129,140,248,0.22), transparent 55%), #020617',
                  height: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isReadOnly ? 'default' : 'pointer',
                }}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt=""
                    width={160}
                    height={96}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={{
                      maxWidth: '80%',
                      maxHeight: '80%',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.55))',
                      display: 'block',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      color: '#6b7280',
                      fontSize: 14,
                    }}
                  >
                    ?대?吏 ?놁쓬
                  </span>
                )}
              </div>

              {/* ?뺣낫 由ъ뒪??*/}
              <div
                style={{
                  padding: '8px 10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {visibleStats.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      padding: '6px 8px',
                      borderRadius: 10,
                      background: 'rgba(15,23,42,.75)',
                    }}
                  >
                    ?쒖떆???뺣낫媛 ?놁뒿?덈떎. (?뺣낫 ?ㅼ젙 踰꾪듉?쇰줈 異붽?)
                  </div>
                )}

                {visibleStats.map((stat) => (
                  <button
                    key={stat.key}
                    type="button"
                    onClick={() => setStatEditKey(stat.key)}
                    style={{
                      borderRadius: 10,
                      padding: '6px 8px',
                      background: isSpirit
                        ? 'linear-gradient(90deg, rgba(2, 18, 20, .96), rgba(4, 32, 35, .88))'
                        : 'linear-gradient(90deg, rgba(15,23,42,.95), rgba(15,23,42,.85))',
                      border: isSpirit
                        ? '1px solid rgba(45, 212, 191, .18)'
                        : '1px solid #111827',
                      boxShadow: isSpirit
                        ? '0 0 16px rgba(20, 184, 166, .08) inset'
                        : undefined,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                    title="?대┃?댁꽌 媛뺥솕蹂??곸꽭 ?뺣낫 蹂닿린/?몄쭛"
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: '#9ca3af',
                        fontWeight: 500,
                      }}
                    >
                      {stat.label}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: '#e5e7eb',
                        fontWeight: 600,
                      }}
                    >
                      {stat.summary || '-'}
                      {stat.unit ? ` ${stat.unit}` : ''}
                    </span>
                  </button>
                ))}
              </div>

              {/* ?섎떒 ?곸긽 踰꾪듉 */}
              {supportsVideo && (
                <div
                  style={{
                    padding: '8px 10px 10px',
                    display: 'flex',
                    gap: showConfigButtons ? 8 : 0,
                    justifyContent: showConfigButtons ? 'stretch' : 'center',
                  }}
                >
                  {/* ??臾몄꽌 濡쒕뱶(readOnly)?먯꽌??媛?대뜲 ?뺣젹 + ?⑥씪 踰꾪듉 */}
                  <button
                    type="button"
                    disabled={!videoSrc}
                    onClick={() => videoSrc && setVideoModalOpen(true)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 999,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      background: videoSrc
                        ? isSpirit
                          ? 'linear-gradient(90deg, #064e3b, #0f766e, #155e75)'
                          : 'linear-gradient(90deg,#1d4ed8,#3b82f6)'
                        : '#111827',

                      boxShadow: videoSrc
                        ? isSpirit
                          ? '0 12px 34px rgba(20,184,166,.42), 0 0 18px rgba(45,212,191,.22)'
                          : '0 12px 30px rgba(37,99,235,0.7)'
                        : 'none',
                      color: videoSrc ? '#f9fafb' : '#6b7280',
                      cursor: videoSrc ? 'pointer' : 'default',
                      flex: showConfigButtons ? 1 : undefined,
                      minWidth: showConfigButtons ? undefined : 160,
                      textAlign: 'center',
                    }}
                  >
                    ?ㅽ궗 ?ъ슜 ?곸긽
                  </button>

                  {/* ?곸긽 ?ㅼ젙 踰꾪듉? ?먮뵒?곗뿉?쒕쭔 ?쒖떆 */}
                  {showConfigButtons && (
                    <button
                      type="button"
                      onClick={() => setVideoSelectOpen(true)}
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
                      ?곸긽 ?ㅼ젙
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ???뺣낫 ?ㅼ젙 踰꾪듉: 移대뱶 ?쒕컰?앹뿉 諛곗튂 (?먮뵒?곗뿉?쒕쭔) */}
        {showConfigButtons && (
          <button
            type="button"
            onClick={() => setStatSelectOpen(true)}
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
            title="?쒖떆???뺣낫 ?좏깮"
          >
            ?뺣낫 ?ㅼ젙
          </button>
        )}
      </div>

      {children}

      {/* ???고겢由???젣 而⑦뀓?ㅽ듃 硫붾돱 (?먮뵒?곗뿉?쒕쭔) */}
      {!isReadOnly && contextMenuPos && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2050,
            background: 'transparent',
          }}
          onMouseDown={() => setContextMenuPos(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: contextMenuPos.x,
              top: contextMenuPos.y,
            }}
          >
            <div
              style={{
                minWidth: 150,
                padding: '4px 0',
                borderRadius: 8,
                background: '#020617',
                border: '1px solid #4b5563',
                boxShadow: '0 8px 24px rgba(0,0,0,.6)',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  Transforms.removeNodes(editor, { at: path });
                  setContextMenuPos(null);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: '#fca5a5',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                臾닿린 移대뱶 ??젣
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 紐⑤떖??(湲곗〈 濡쒖쭅 ?좎?) */}
      <WeaponTypeSelectModal
        open={typeModalOpen && !isReadOnly}
        currentType={weaponType}
        onClose={() => setTypeModalOpen(false)}
        onSelect={(t) => {
          handleWeaponTypeChange(t);
          setTypeModalOpen(false);
        }}
      />

      <WeaponNameEditModal
        open={nameModalOpen && !isReadOnly}
        initialName={el.name}
        onClose={() => setNameModalOpen(false)}
        onSave={(name) => {
          updateElement({ name });
          setNameModalOpen(false);
        }}
      />

      <ImageSelectModal
        open={imageModalOpen && !isReadOnly}
        onClose={() => setImageModalOpen(false)}
        onSelectImage={handleImageSelected}
      />

      {supportsVideo && (
        <ImageSelectModal
          open={videoSelectOpen && !isReadOnly}
          onClose={() => setVideoSelectOpen(false)}
          onSelectImage={handleVideoSelected}
        />
      )}

      <WeaponStatEditModal
        open={!!statEditKey}
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
        open={statSelectOpen && !isReadOnly}
        weaponType={weaponType}
        stats={stats}
        onClose={() => setStatSelectOpen(false)}
        onSave={(nextStats) => {
          handleSaveStatsSelection(nextStats);
          setStatSelectOpen(false);
        }}
      />

      {supportsVideo && (
        <WeaponVideoModal
          open={videoModalOpen && !!videoSrc}
          url={videoSrc}
          onClose={() => setVideoModalOpen(false)}
        />
      )}
    </>
  );

  return (
    <WeaponBlock
      mode={isReadOnly ? 'read' : 'edit'}
      attributes={attributes as React.HTMLAttributes<HTMLDivElement>}
      content={content}
    />
  );
}

export default WeaponCard;