'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  RenderElementProps,
  ReactEditor,
  useSelected,
  useFocused,
  useSlate,
  useSlateStatic,
} from 'slate-react';
import { Node, Transforms, Path, Editor, Element as SlateElement, Text } from 'slate';
import { getHeadingId } from './helpers/getHeadingId';
import ImageSizeModal from './ImageSizeModal';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import { toProxyUrl } from '@lib/cdn';
import type {
  InlineMarkElement,
  InlineImageElement,
  PriceTableCardElement,
  CustomElement,
  LinkBlockElement,
  HeadingOneElement,
  HeadingTwoElement,
  HeadingThreeElement,
  ParagraphElement,
  TableElement,
  VideoElement,
  WeaponCardElement,
  WeaponStatConfig,
  WeaponType,
  WeaponStatKey,
} from '@/types/slate';
import { tablePathKey, useDragRect, beginDrag, hoverCell, selectRectDirect, isDragPrimedOrActive } from './helpers/tableDrag';

// -------------------- 모듈 전역 캐시 (HMR 안전) --------------------
const WIKI_ICON_CACHE_KEY = '__rdwiki_doc_icon_cache__';
const WIKI_DOCS_ALL_KEY = '__rdwiki_docs_all__';

const wikiDocIconCache: Map<string, string> =
  (globalThis as any)[WIKI_ICON_CACHE_KEY] ?? new Map<string, string>();
(globalThis as any)[WIKI_ICON_CACHE_KEY] = wikiDocIconCache;

let wikiDocsAll: any[] | null = (globalThis as any)[WIKI_DOCS_ALL_KEY] ?? null;
const setWikiDocsAll = (rows: any[]) => {
  wikiDocsAll = rows;
  (globalThis as any)[WIKI_DOCS_ALL_KEY] = rows;
};

// 외부 링크용 인라인 아이콘
const ExternalLinkIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0  0 0 2-2v-7h-2v7z" fill="currentColor"/>
  </svg>
);

// -------------------- 유틸 --------------------
function getPriceBadgeColor(stage: string, _type?: string) {
  switch (stage) {
    case '봉인':
      return '#444';
    case '1각':
    case '2각':
    case '3각':
    case '4각':
      return '#48ea6d';
    case 'MAX':
      return '#ffe360';
    case '거가':
      return '#43b04b';
    case '거불':
      return '#e44c4c';
    default:
      return '#5cacee';
  }
}
function guessPriceMode(item: any): 'normal' | 'awakening' | 'transcend' {
  if (!item.stages) return 'normal';
  const set = new Set(item.stages);
  if (item.stages.length === 6 && set.has('봉인') && set.has('MAX')) return 'awakening';
  if (item.stages.includes('거가') && item.stages.includes('거불')) return 'transcend';
  return 'normal';
}

// 길이에 따라 글자 크기 자동 축소
function autoFont(base: number, text: string, steps?: Array<[number, number]>) {
  const len = Array.from(text ?? '').length;
  const rules: Array<[number, number]> =
    steps ?? [
      [8, base],
      [12, base - 2],
      [16, base - 4],
      [20, base - 6],
      [26, base - 8],
      [34, base - 9],
    ];
  for (const [threshold, size] of rules) {
    if (len <= threshold) return size;
  }
  return Math.max(11, (rules.at(-1)?.[1] ?? base) - 2);
}

/** 가격 텍스트: 필요시에만 줄바꿈 */
function PriceText({ value }: { value: string | number }) {
  const s = String(value ?? '');
  if (!s.includes('~')) return <span className="ptc-price-text">{s}</span>;
  const [left, right] = s.split('~', 2);
  return (
    <span className="ptc-price-text">
      <span style={{ whiteSpace: 'nowrap' }}>{left}~</span>
      <wbr />
      <span style={{ whiteSpace: 'nowrap' }}>{right}</span>
    </span>
  );
}

function nameFontSize(name?: string) {
  const n = (name ?? '').trim();
  if (n.length >= 12) return 16;
  if (n.length >= 9) return 18;
  return 20;
}

const isProbablyVideo = (url: string, mime?: string | null) => {
  if (mime && mime.startsWith('video/')) return true;
  const clean = url.split('?')[0].split('#')[0];
  const ext = clean.substring(clean.lastIndexOf('.') + 1).toLowerCase();
  return ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'avi', 'mkv'].includes(ext);
};

const WEAPON_TYPES_META: Record<
  WeaponType,
  { label: string; headerBg: string; border: string; badgeBg: string }
> = {
  epic:      { label: 'EPIC',      headerBg: '#7c3aed', border: '#a855f7', badgeBg: '#5b21b6' },
  unique:    { label: 'UNIQUE',    headerBg: '#0ea5e9', border: '#38bdf8', badgeBg: '#0369a1' },
  legendary: { label: 'LEGEND',    headerBg: '#f97373', border: '#fb7185', badgeBg: '#b91c1c' },
  divine:    { label: 'DIVINE',    headerBg: '#22c55e', border: '#4ade80', badgeBg: '#15803d' },
  superior:  { label: 'SUPERIOR',  headerBg: '#eab308', border: '#facc15', badgeBg: '#92400e' },
  class:     { label: 'CLASS',     headerBg: '#6366f1', border: '#818cf8', badgeBg: '#312e81' },
  hidden:    { label: 'HIDDEN',    headerBg: '#0f766e', border: '#14b8a6', badgeBg: '#134e4a' },
  limited:   { label: 'LIMITED',   headerBg: '#f97316', border: '#fdba74', badgeBg: '#c2410c' },
  ancient:   { label: 'ANCIENT',   headerBg: '#6b7280', border: '#9ca3af', badgeBg: '#374151' },
};

const ALL_WEAPON_STAT_KEYS: WeaponStatKey[] = [
  'damage',
  'cooldown',
  'hitCount',
  'range',
  'duration',
  'heal',
];

const WEAPON_STAT_PRESET: Record<
  WeaponStatKey,
  { label: string; defaultUnit?: string }
> = {
  damage:   { label: '데미지' },
  cooldown: { label: '쿨타임', defaultUnit: '초' },
  hitCount: { label: '타수',   defaultUnit: '타' },
  range:    { label: '범위' },
  duration: { label: '지속시간', defaultUnit: '초' },
  heal:     { label: '회복량' },
};

// 무기 유형별 강화 단계 라벨
export function getWeaponLevelLabels(type: WeaponType): string[] {
  switch (type) {
    // 1강 ~ MAX(5강)
    case 'epic':
    case 'unique':
    case 'legendary':
    case 'divine':
    case 'superior':
      return ['1강', '2강', '3강', '4강', 'MAX'];
    // 1강 ~ MAX(9강)
    case 'class':
      return ['1강', '2강', '3강', '4강', '5강', '6강', '7강', '8강', 'MAX'];
    // 나머지는 단일 단계
    case 'hidden':
    case 'limited':
    case 'ancient':
    default:
      return ['기본'];
  }
}

function normalizeStatLevels(
  levels: WeaponStatConfig['levels'] | undefined,
  type: WeaponType,
): WeaponStatConfig['levels'] {
  const labels = getWeaponLevelLabels(type);
  const list = levels ?? [];
  return labels.map((label, idx) => ({
    levelLabel: label,
    value: list[idx]?.value ?? '',
  }));
}

function createEmptyWeaponStat(
  key: WeaponStatKey,
  type: WeaponType,
  enabled: boolean,
): WeaponStatConfig {
  const preset = WEAPON_STAT_PRESET[key];
  return {
    key,
    label: preset.label,
    summary: '',
    unit: preset.defaultUnit,
    enabled,
    levels: normalizeStatLevels([], type),
  };
}

// 현재 stats 배열을 기준으로, 모든 stat 키를 채우고 단계 구조를 유형에 맞게 정규화
function ensureWeaponStats(
  stats: WeaponStatConfig[] | undefined,
  type: WeaponType,
): WeaponStatConfig[] {
  const map = new Map<WeaponStatKey, WeaponStatConfig>();
  (stats ?? []).forEach((s) => map.set(s.key, s));

  return ALL_WEAPON_STAT_KEYS.map((key) => {
    const existing = map.get(key);
    if (!existing) {
      // 기본은 데미지 / 쿨타임만 on, 나머지는 off
      const enabled = key === 'damage' || key === 'cooldown';
      return createEmptyWeaponStat(key, type, enabled);
    }
    return {
      ...existing,
      label: existing.label || WEAPON_STAT_PRESET[key].label,
      unit: existing.unit ?? WEAPON_STAT_PRESET[key].defaultUnit,
      levels: normalizeStatLevels(existing.levels, type),
    };
  });
}

function normalizeStatsForWeaponType(
  stats: WeaponStatConfig[] | undefined,
  type: WeaponType,
): WeaponStatConfig[] {
  return ensureWeaponStats(stats, type).map((s) => ({
    ...s,
    levels: normalizeStatLevels(s.levels, type),
  }));
}



// -------------------- 타입 --------------------
type PriceTableEditState = {
  blockPath: Path | null;
  idx: number | null;
  item: any | null;
};

type ElementProps = RenderElementProps & {
  editor: any;
  onIconClick: (element: CustomElement) => void;
  priceTableEdit: PriceTableEditState;
  setPriceTableEdit: React.Dispatch<React.SetStateAction<PriceTableEditState>>;
};

// -------------------- 메인 렌더러 --------------------
const Element: React.FC<ElementProps> = ({
  attributes,
  children,
  element,
  editor,
  onIconClick,
  priceTableEdit, // eslint-disable-line @typescript-eslint/no-unused-vars
  setPriceTableEdit,
}) => {
  const slateEditor = useSlate();
  const editorStatic = useSlateStatic();
  const [hovered, setHovered] = useState<number | null>(null);

  switch (element.type) {
    // -------------------- 인라인 링크 --------------------
    case 'link': {
      return (
        <a
          {...attributes}
          href={(element as any).url}
          style={{ color: '#2676ff' }}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {children}
        </a>
      );
    }

    // -------------------- 카드형 링크 블록 (void) --------------------
    case 'link-block': {
      const el = element as LinkBlockElement;
      const isReadOnly = ReactEditor.isReadOnly(editor);

      let displaySitename = el.sitename;

      if (!el.isWiki && !displaySitename) {
        try {
          const u = new URL(el.url);
          const host = u.hostname.replace(/^www\./, '');
          if (!displaySitename) displaySitename = host;
        } catch {}
      }

      const [wikiIcon, setWikiIcon] = React.useState<string | null>(
        el.isWiki ? (el as any).docIcon ?? null : null
      );

      React.useEffect(() => {
        if (!el.isWiki || wikiIcon) return;
        const key = String(el.wikiPath ?? el.url ?? el.wikiTitle ?? '');
        if (!key) return;

        if (wikiDocIconCache.has(key)) {
          setWikiIcon(wikiDocIconCache.get(key)!);
          return;
        }

        let cancelled = false;
        (async () => {
          try {
            if (!wikiDocsAll) {
              const res = await fetch('/api/documents?all=1', { cache: 'force-cache' });
              const data = await res.json();
              setWikiDocsAll(Array.isArray(data) ? data : []);
            }
            const docs = wikiDocsAll || [];
            const match = docs.find(
              (d: any) =>
                (el.wikiPath && String(d.path) === String(el.wikiPath)) ||
                (el.wikiTitle && d.title === el.wikiTitle)
            );
            const icon = (match?.icon ?? '').trim();
            if (!cancelled) {
              if (icon) {
                setWikiIcon(icon);
                wikiDocIconCache.set(key, icon);
              } else {
                setWikiIcon(null);
              }
            }
          } catch {
            if (!cancelled) setWikiIcon(null);
          }
        })();

        return () => { cancelled = true; };
      }, [el.isWiki, el.wikiPath, el.wikiTitle, el.url, wikiIcon]);

      const isSmall = el.size === 'small' || (el as any).size === 'half';

      // 부모가 link-block-row인지 여부
      let inRow = false;
      try {
        const path = ReactEditor.findPath(editor, element);
        const parent = Node.parent(editor as any, path);
        inRow = SlateElement.isElement(parent) && (parent as any).type === 'link-block-row';
      } catch {}

      const wrapperStyle: React.CSSProperties = isSmall
        ? {
            display: inRow ? 'block' : 'inline-block',
            verticalAlign: 'top',
            width: 'calc(50% - 6px)',
            maxWidth: 'calc(50% - 6px)',
            marginRight: inRow ? 0 : 12,
          }
        : { display: 'block', width: '100%', maxWidth: '100%' };

      return (
        <div {...attributes} style={{ position: 'relative', ...wrapperStyle }}>
          <div
            contentEditable={false}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 6,
              marginBottom: 8,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {!isReadOnly && (
              <button
                type="button"
                aria-label="링크 카드 삭제"
                onClick={() => {
                  const path = ReactEditor.findPath(editor, element);
                  Transforms.removeNodes(editor, { at: path });
                }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 6,
                  width: 20,
                  height: 20,
                  lineHeight: '20px',
                  fontSize: 20,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  color: '#e11d48',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            )}

            {/* 아이콘 */}
            {el.isWiki ? (
              wikiIcon ? (
                wikiIcon.startsWith('http') ? (
                  <img
                    src={toProxyUrl(wikiIcon)}
                    alt="doc icon"
                    width={24}
                    height={24}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    style={{ width: 24, height: 24, marginRight: 8, objectFit: 'contain', display: 'block' }}
                    draggable={false}
                  />
                ) : (
                  <span style={{ fontSize: 20, marginRight: 8, lineHeight: 1 }}>{wikiIcon}</span>
                )
              ) : null
            ) : (
              <span
                style={{
                  width: 24,
                  height: 24,
                  marginRight: 8,
                  display: 'inline-flex',
                  alignItems:'center',
                  justifyContent:'center',
                  color:'#64748b'
                }}
                aria-hidden
              >
                <ExternalLinkIcon size={18} />
              </span>
            )}

            {/* 타이틀/링크 */}
            <a
              href={el.url}
              target={el.isWiki ? undefined : '_blank'}
              rel={el.isWiki ? undefined : 'noopener noreferrer nofollow'}
              style={{ color: '#0070f3', textDecoration: 'none', flexGrow: 1 }}
            >
              {el.isWiki ? el.wikiTitle || el.sitename || '문서' : displaySitename || el.url}
            </a>
          </div>

          {children}
        </div>
      );
    }

    // -------------------- Heading --------------------
    case 'heading-one':
    case 'heading-two':
    case 'heading-three': {
      const el = element as HeadingOneElement | HeadingTwoElement | HeadingThreeElement;
      const level = el.type === 'heading-one' ? 1 : el.type === 'heading-two' ? 2 : 3;
      const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px';
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';

      const justify =
        el.textAlign === 'center' ? 'center'
        : el.textAlign === 'right'  ? 'flex-end'
        : 'flex-start';

      return (
        <Tag
          {...attributes}
          id={getHeadingId(el)}
          style={{
            fontSize,
            textAlign: el.textAlign || 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: justify,
            width: '100%',
          }}
        >
          <span
            onClick={() => onIconClick(el)}
            contentEditable={false}
            style={{ cursor: 'pointer', marginRight: 8, display: 'inline-flex', alignItems: 'center' }}
          >
            {el.icon?.startsWith('http') ? (
              <img
                src={toProxyUrl(el.icon)}
                alt="icon"
                width={28}
                height={28}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                style={{
                  width: '1.7em',
                  height: '1.7em',
                  verticalAlign: 'middle',
                  marginRight: 6,
                  objectFit: 'contain',
                  display: 'block',
                }}
                draggable={false}
              />
            ) : (
              <span style={{ fontSize: '1.5em', marginRight: 6 }}>
                {el.icon || (level === 1 ? '📌' : level === 2 ? '🔖' : '📝')}
              </span>
            )}
          </span>
          <span style={{ display: 'inline' }}>{children}</span>
        </Tag>
      );
    }

    // -------------------- Divider (void) --------------------
    case 'divider': {
      const styleType = (element as any).style || 'default';
      const borderColor = '#e0e0e0';

      return (
        <div {...attributes}>
          <div contentEditable={false}>
            {styleType === 'bold' && (
              <div style={{ width: '95%', margin: '32px auto', textAlign: 'center' }}>
                <hr style={{ border: 0, borderTop: `4px solid ${borderColor}`, width: '100%', margin: '0 auto' }} />
              </div>
            )}
            {styleType === 'shortbold' && (
              <div style={{ width: 82, margin: '34px auto', textAlign: 'center' }}>
                <hr style={{ border: 0, borderTop: `5px solid ${borderColor}`, width: '100%', margin: '0 auto' }} />
              </div>
            )}
            {styleType === 'dotted' && (
              <div style={{ width: '70%', margin: '28px auto', textAlign: 'center' }}>
                <hr style={{ border: 0, borderTop: `2px dotted ${borderColor}`, width: '100%', margin: '0 auto' }} />
              </div>
            )}
            {styleType === 'diamond' && (
              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <span style={{ fontSize: 24, letterSpacing: 12, color: borderColor }}>◇───◇</span>
              </div>
            )}
            {styleType === 'diamonddot' && (
              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <span style={{ fontSize: 22, letterSpacing: 6, color: borderColor }}>◇ ⋅ ⋅ ⋅ ◇</span>
              </div>
            )}
            {styleType === 'dotdot' && (
              <div style={{ width: '100%', margin: '30px 0', textAlign: 'center' }}>
                <span style={{ fontSize: 28, letterSpacing: 8, color: borderColor }}>• • • • • • •</span>
              </div>
            )}
            {styleType === 'slash' && (
              <div style={{ width: '100%', margin: '30px 0', textAlign: 'center' }}>
                <span style={{ fontSize: 30, letterSpacing: 14, color: borderColor }}>/  /  /</span>
              </div>
            )}
            {styleType === 'bar' && (
              <div style={{ width: '100%', margin: '28px 0', textAlign: 'center' }}>
                <span style={{ fontSize: 22, color: borderColor }}>|</span>
              </div>
            )}
            {styleType === 'default' && (
              <div style={{ width: '95%', margin: '24px auto', textAlign: 'center' }}>
                <hr style={{ border: 0, borderTop: `1.5px solid ${borderColor}`, width: '100%', margin: '0 auto' }} />
              </div>
            )}
          </div>
          {children}
        </div>
      );
    }

    // -------------------- 기본 문단 --------------------
    case 'paragraph': {
      const el = element as ParagraphElement;
      const indentLine = (el as any).indentLine;

      let extraClass = '';
      if (indentLine) {
        const path = ReactEditor.findPath(slateEditor, element);
        let isFirst = true, isLast = true;
        try {
          const prevPath = Path.previous(path);
          const prevNode = Node.get(slateEditor, prevPath) as any;
          if (prevNode && prevNode.indentLine) isFirst = false;
        } catch {}
        try {
          const nextPath = Path.next(path);
          const nextNode = Node.get(slateEditor, nextPath) as any;
          if (nextNode && nextNode.indentLine) isLast = false;
        } catch {}
        if (isFirst) extraClass += ' start';
        if (isLast) extraClass += ' end';
      }

      return (
        <p
          {...attributes}
          style={{
            textAlign: el.textAlign || 'left',
            borderLeft: indentLine ? '2px solid #D5D9E0' : undefined,
            paddingLeft: indentLine ? 16 : undefined,
            margin: 0,
          }}
          className={indentLine ? `slate-indent-line${extraClass}` : undefined}
        >
          {children}
        </p>
      );
    }

    // -------------------- 인포박스 --------------------
    case 'info-box': {
      const raw =
        (element as any).boxType ||
        (element as any).variant ||
        (element as any).tone ||
        (element as any).infoType ||
        'note';

      const tone: 'note' | 'warn' | 'danger' | 'tip' =
        raw === 'danger' || raw === 'error'
          ? 'danger'
          : raw === 'warn' || raw === 'warning'
          ? 'warn'
          : raw === 'tip' || raw === 'success'
          ? 'tip'
          : 'note';

      return (
        <div {...attributes} className={`infobox infobox--${tone}`}>
          <span className="infobox__icon" aria-hidden="true" contentEditable={false} />
          <div className="infobox__body">{children}</div>
        </div>
      );
    }

    // -------------------- 본문 이미지 (void) --------------------
    case 'image': {
      const el = element as any;
      const selected = useSelected();
      const focused = useFocused();
      const [modalOpen, setModalOpen] = useState(false);

      const imgRef = useRef<HTMLImageElement | null>(null);
      const [initSize, setInitSize] = useState<{ w?: number; h?: number }>({});

      const EditIcon = ({ size = 18, color = '#2a90ff' }) => (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 17h3.8a1 1 0 0 0 .7-.3l8.4-8.4a2 2 0 0 0 0-2.8l-1.7-1.7a2 2 0 0 0-2.8 0L3.3 12.2a1 1 0 0 0-.3.7V17z" stroke={color} strokeWidth="1.7" />
          <path d="M11.7 6.3l2.5 2.5" stroke={color} strokeWidth="1.7" />
        </svg>
      );

      let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'center';
      if (el.textAlign === 'left') justifyContent = 'flex-start';
      else if (el.textAlign === 'right') justifyContent = 'flex-end';

      const handleSaveSize = (width: number, height: number) => {
        const path = ReactEditor.findPath(editor, element);
        Transforms.setNodes(editor, { width, height }, { at: path });
        setModalOpen(false);
      };

      const imgSrc = typeof el.url === 'string' && el.url.startsWith('http') ? toProxyUrl(el.url) : el.url;

      return (
        <div {...attributes} style={{ margin: '16px 0' }}>
          <div
            key={el.textAlign || 'center'}
            contentEditable={false}
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent,
              alignItems: 'flex-start',
              minHeight: 40,
            }}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={imgSrc}
                alt=""
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                draggable={false}
                style={{
                  maxWidth: el.width ? el.width + 'px' : '90%',
                  height: el.height ? el.height + 'px' : 'auto',
                  borderRadius: 10,
                  boxShadow: '0 2px 12px 0 #0001',
                  background: '#fff',
                  display: 'block',
                  border: selected && focused ? '2px solid #2a90ff' : 'none',
                  transition: 'border 0.1s',
                }}
              />
              {selected && (
                <button
                  type="button"
                  aria-label="이미지 크기 편집"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const img = imgRef.current;
                    const rectW = Math.round(img?.getBoundingClientRect().width || 0);
                    const rectH = Math.round(img?.getBoundingClientRect().height || 0);
                    const natW = img?.naturalWidth || 0;
                    const natH = img?.naturalHeight || 0;

                    const w = el.width || rectW || natW || 256;
                    const h = el.height || rectH || natH || 256;
                    setInitSize({ w, h });
                    setModalOpen(true);
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: '#fff',
                    border: '1.5px solid #2a90ff',
                    borderRadius: '50%',
                    boxShadow: '0 1px 5px #0001',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 1,
                    padding: 0,
                  }}
                  tabIndex={-1}
                  title="이미지 크기 편집"
                >
                  <EditIcon size={18} color="#2a90ff" />
                </button>
              )}
            </div>
          </div>

          {children}

          <ImageSizeModal
            open={modalOpen}
            width={initSize.w}
            height={initSize.h}
            onSave={handleSaveSize}
            onClose={() => setModalOpen(false)}
          />
        </div>
      );
    }

    // -------------------- 인라인 이미지 --------------------
    case 'inline-image': {
      const el = element as InlineImageElement;
      const src = el.url?.startsWith('http') ? toProxyUrl(el.url) : el.url;
      return (
        <span {...attributes} contentEditable={false} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            draggable={false}
            style={{ height: '3em', width: 'auto', display: 'inline', verticalAlign: 'middle', margin: '0 2px', borderRadius: 4 }}
          />
          {children}
        </span>
      );
    }

    // -------------------- 인라인 마크 --------------------
    case 'inline-mark': {
      const el = element as InlineMarkElement;
      return (
        <span
          {...attributes}
          contentEditable={false}
          style={{
            display: 'inline-block',
            fontWeight: 'bold',
            color: el.color || '#888',
            fontSize: '1.08em',
            marginRight: 8,
            marginLeft: 2,
            userSelect: 'none',
            verticalAlign: 'middle',
          }}
          className="inline-mark"
        >
          {el.icon}
          {children}
        </span>
      );
    }

    // -------------------- 가격표 카드 (void) --------------------
    case 'price-table-card': {
      const el = element as PriceTableCardElement;
      const path = ReactEditor.findPath(editorStatic, el);

      useEffect(() => {
        const handler = (e: KeyboardEvent) => {
          const { selection } = editorStatic;
          if (!selection || !ReactEditor.isFocused(editorStatic)) return;
          const [node] = Editor.node(editorStatic, selection, { depth: 1 });
          if (SlateElement.isElement(node) && node.type === 'price-table-card' && e.key === 'Backspace') {
            e.preventDefault();
          }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
      }, [editorStatic]);

      const [stageIdxArr, setStageIdxArr] = useState(el.items.map(() => 0));
      useEffect(() => {
        setStageIdxArr(el.items.map(() => 0));
      }, [el.items]);

      const handlePrev = (idx: number, len: number) => {
        setStageIdxArr(arr => arr.map((v, i) => (i === idx ? (v - 1 + len) % len : v)));
      };
      const handleNext = (idx: number, len: number) => {
        setStageIdxArr(arr => arr.map((v, i) => (i === idx ? (v + 1) % len : v)));
      };

      return (
        <div {...attributes}>
          <div
            contentEditable={false}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 0,
              boxSizing: 'border-box',
              padding: '10px 0',
              margin: '10px 0',
              marginLeft: 10,
              position: 'relative',
            }}
          >
            <button
              type="button"
              aria-label="시세표 블럭 삭제"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
                background: '#fff',
                color: '#d34b4b',
                border: '1.2px solid #e6b7b7',
                borderRadius: '50%',
                width: 26,
                height: 26,
                fontWeight: 900,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 8px #0001',
                cursor: 'pointer',
                transition: 'background .13s',
              }}
              title="시세표 블럭 삭제"
              tabIndex={-1}
              onClick={e => {
                e.stopPropagation();
                const pathToRemove = ReactEditor.findPath(editorStatic, element);
                Transforms.removeNodes(editorStatic, { at: pathToRemove });
              }}
            >
              ×
            </button>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 25,
                flexWrap: 'nowrap',
                width: '100%',
                justifyContent: 'center',
                margin: '0 auto',
                maxWidth: 1040,
              }}
            >
              {el.items.map((item, idx) => {
                const stages: string[] = item.stages || ['가격'];
                const prices: Array<string | number> =
                  Array.isArray(item.prices) && item.prices.length ? item.prices : [0];

                const curIdx = stageIdxArr[idx] ?? 0;
                const stage = stages[curIdx] ?? '';
                const priceVal = prices[curIdx] ?? '';
                const badgeColor = getPriceBadgeColor(stage, item.colorType);

                const [editingName, setEditingName] = useState(false);
                const [editNameValue, setEditNameValue] = useState(item.name || '');
                const [imageModalOpen, setImageModalOpen] = useState(false);

                const handleImageSelect = (url: string) => {
                  const newItems = el.items.map((itm, i) => (i === idx ? { ...itm, image: url } : itm));
                  Transforms.setNodes(editorStatic, { items: newItems }, { at: path });
                  setImageModalOpen(false);
                };

                const handleNameSave = () => {
                  const newItems = el.items.map((itm, i) => (i === idx ? { ...itm, name: editNameValue } : itm));
                  Transforms.setNodes(editorStatic, { items: newItems }, { at: path });
                  setEditingName(false);
                };

                const imgSrc = item.image?.startsWith?.('http') ? toProxyUrl(item.image) : item.image;

                const nameShown = item.name || '이름 없음';
                const nameFont = autoFont(20, String(nameShown), [
                  [7, 18], [9, 16], [12, 14], [16, 13], [20, 12],
                ]);
                const priceFont = autoFont(20, String(priceVal), [
                  [8, 20], [12, 18], [16, 16], [22, 14], [30, 12], [40, 11],
                ]);

                return (
                  <div
                    key={idx}
                    style={{
                      background: '#fff',
                      borderRadius: 15,
                      padding: 8,
                      boxShadow: '0 4px 24px 0 rgba(60,60,80,0.12)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative',
                      minWidth: 140,
                      maxWidth: 140,
                      minHeight: 160,
                      transition: 'box-shadow .15s',
                      zIndex: 0,
                      margin: '0 8px',
                    }}
                    onMouseEnter={() => setHovered(idx)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {stages.length > 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 5,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          zIndex: 3,
                          width: 66,
                          display: 'flex',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            background: badgeColor,
                            color: stage === '봉인' ? '#fff' : '#222',
                            padding: '4px 0px',
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 15,
                            width: 66,
                            display: 'inline-block',
                            boxShadow: '0 1px 8px #0001',
                            border: '1.5px solid #fff',
                            textAlign: 'center',
                            letterSpacing: 1,
                            transition: 'background .1s',
                          }}
                        >
                          {stage}
                        </span>
                      </div>
                    )}

                    {hovered === idx && (
                      <>
                        <button
                          type="button"
                          aria-label="이전 단계"
                          style={{
                            position: 'absolute',
                            left: -12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: '#fff',
                            border: '1.2px solid #eee',
                            borderRadius: '50%',
                            width: 28,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: 16,
                            boxShadow: '0 2px 6px #0001',
                            zIndex: 2,
                          }}
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            handlePrev(idx, stages.length);
                          }}
                          title="이전"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          aria-label="다음 단계"
                          style={{
                            position: 'absolute',
                            right: -12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: '#fff',
                            border: '1.2px solid #eee',
                            borderRadius: '50%',
                            width: 28,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: 16,
                            boxShadow: '0 2px 6px #0001',
                            zIndex: 2,
                          }}
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            handleNext(idx, stages.length);
                          }}
                          title="다음"
                        >
                          ▶
                        </button>
                      </>
                    )}

                    <div
                      style={{
                        marginBottom: 10,
                        marginTop: 34,
                        cursor: 'pointer',
                        width: 65,
                        height: 65,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setImageModalOpen(true);
                      }}
                      title="이미지 변경"
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt=""
                          width={65}
                          height={65}
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          style={{ width: 65, height: 65, objectFit: 'contain', borderRadius: 7, background: '#fff', display: 'block' }}
                          draggable={false}
                        />
                      ) : (
                        <span style={{ width: 54, height: 54, background: '#ececec', borderRadius: 7, display: 'inline-block' }} />
                      )}
                    </div>
                    <ImageSelectModal
                      open={imageModalOpen}
                      onClose={() => setImageModalOpen(false)}
                      onSelectImage={handleImageSelect}
                    />

                    {/* 이름 */}
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: nameFont,
                        lineHeight: 1.12,
                        marginBottom: 0,
                        color: item.name ? '#333' : '#bbb',
                        textAlign: 'center',
                        minHeight: 24,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                    >
                      {editingName ? (
                        <input
                          value={editNameValue}
                          onChange={e => setEditNameValue(e.target.value)}
                          onBlur={handleNameSave}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleNameSave();
                            if (e.key === 'Escape') setEditingName(false);
                          }}
                          onFocus={() => {
                            try { Transforms.deselect(editorStatic); } catch {}
                          }}
                          style={{
                            fontSize: nameFont,
                            fontWeight: 700,
                            color: '#333',
                            textAlign: 'center',
                            border: '1.5px solid #b4cafe',
                            borderRadius: 6,
                            padding: '2px 6px',
                            outline: 'none',
                            width: '80%',
                          }}
                        />
                      ) : (
                        <span
                          style={{ cursor: 'pointer', width: '100%' }}
                          onClick={e => {
                            e.stopPropagation();
                            setEditNameValue(item.name || '');
                            setEditingName(true);
                            try { Transforms.deselect(editorStatic); } catch {}
                          }}
                          title="이름 수정"
                        >
                          {item.name || <span style={{ color: '#bbb' }}>이름 없음</span>}
                        </span>
                      )}
                    </div>

                    {/* 가격 */}
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: priceFont,
                        lineHeight: 1.04,
                        color: '#5b80f5',
                        textAlign: 'center',
                        letterSpacing: 1,
                        marginTop: 3,
                        cursor: 'pointer',
                        borderRadius: 8,
                        padding: '2px 10px',
                        minHeight: 28,
                      }}
                      title="가격 수정"
                      onClick={e => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('editor:capture-scroll:price'));
                        setPriceTableEdit({ blockPath: path, idx, item: { ...item, mode: guessPriceMode(item) } });
                      }}
                    >
                      <PriceText value={priceVal} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {children}
        </div>
      );
    }

    // -------------------- 링크 블록 Row --------------------
    case 'link-block-row': {
      return (
        <div
          {...attributes}
          style={{
            display: 'flex',
            gap: 12,
            margin: '8px 0',
            width: '100%',
            flexWrap: 'wrap',
            alignItems: 'stretch',
          }}
        >
          {children}
        </div>
      );
    }

        // -------------------- 표(Table) --------------------
    case 'table': {
      const table = element as TableElement;

      // 이 테이블의 고유 키
      const tablePath = ReactEditor.findPath(editor, element);
      const tkey = tablePathKey(tablePath);

      // 드래그 사각형 상태
      const rect = useDragRect(tkey);

      // 오버레이/레일/폭 조절용 ref & 상태
      const wrapRef = React.useRef<HTMLDivElement | null>(null);
      const ovRef = React.useRef<HTMLDivElement | null>(null);

      // 노드에 저장된 폭(px)
      const widthFromNode =
        typeof table.maxWidth === 'number' ? table.maxWidth : null;
      const [liveWidth, setLiveWidth] = React.useState<number | null>(
        widthFromNode,
      );

      React.useEffect(() => {
        setLiveWidth(widthFromNode);
      }, [widthFromNode]);

      // 오버레이 위치 맞추기
      const positionOverlay = React.useCallback(() => {
        const wrap = wrapRef.current,
          ov = ovRef.current;
        if (!wrap || !ov || !rect) {
          if (ov) ov.style.display = 'none';
          return;
        }

        const q = (r: number, c: number) =>
          wrap.querySelector(
            `td.slate-table__cell[data-tkey="${tkey}"][data-r="${r}"][data-c="${c}"]`,
          ) as HTMLElement | null;

        const a = q(rect.r0, rect.c0);
        const b = q(rect.r1, rect.c1);
        if (!a || !b) {
          ov.style.display = 'none';
          return;
        }

        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const base = wrap.getBoundingClientRect();

        const left = Math.round(ra.left - base.left);
        const top = Math.round(ra.top - base.top);
        const right = Math.round(rb.right - base.left);
        const bottom = Math.round(rb.bottom - base.top);

        ov.style.display = 'block';
        ov.style.left = left + 'px';
        ov.style.top = top + 'px';
        ov.style.width = Math.max(0, right - left - 1) + 'px';
        ov.style.height = Math.max(0, bottom - top - 1) + 'px';
      }, [rect, tkey]);

      React.useLayoutEffect(() => {
        positionOverlay();
      }, [positionOverlay]);

      React.useEffect(() => {
        if (!wrapRef.current) return;
        const ro = new ResizeObserver(() => positionOverlay());
        ro.observe(wrapRef.current);
        return () => ro.disconnect();
      }, [positionOverlay]);

      // 좌 레일 클릭 → 행 전체 선택
      const onRailLeft = (e: React.MouseEvent<HTMLDivElement>) => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const trs = Array.from(
          wrap.querySelectorAll('tr'),
        ) as HTMLElement[];
        const y = e.clientY;
        let row = 0;
        for (let i = 0; i < trs.length; i++) {
          const r = trs[i].getBoundingClientRect();
          if (y >= r.top && y <= r.bottom) {
            row = i;
            break;
          }
        }
        const cols =
          (trs[0]?.querySelectorAll('td.slate-table__cell')?.length ?? 1) - 1;
        selectRectDirect(editor, tablePath, tkey, row, 0, row, Math.max(0, cols));
      };

      // 상 레일 클릭 → 열 전체 선택
      const onRailTop = (e: React.MouseEvent<HTMLDivElement>) => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const firstRow = wrap.querySelector('tr');
        if (!firstRow) return;
        const tds = Array.from(
          firstRow.querySelectorAll('td.slate-table__cell'),
        ) as HTMLElement[];
        const x = e.clientX;
        let col = 0;
        for (let i = 0; i < tds.length; i++) {
          const r = tds[i].getBoundingClientRect();
          if (x >= r.left && x <= r.right) {
            col = i;
            break;
          }
        }
        const rows = wrap.querySelectorAll('tr').length - 1;
        selectRectDirect(editor, tablePath, tkey, 0, col, Math.max(0, rows), col);
      };

      // 폭 조절 핸들 드래그
      const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const wrap = wrapRef.current;
        if (!wrap) return;

        const startX = e.clientX;
        const rect = wrap.getBoundingClientRect();
        const startWidth = liveWidth ?? rect.width;
        const parentRect = wrap.parentElement?.getBoundingClientRect();
        const containerWidth = parentRect?.width ?? window.innerWidth;

        // ✅ 표 최소 너비: 400px
        const MIN = 400;
        const MAX = Math.max(MIN, containerWidth - 16);
        let latest = startWidth;

        const onMove = (ev: MouseEvent) => {
          ev.preventDefault();
          const dx = ev.clientX - startX;
          let next = startWidth + dx;
          if (!Number.isFinite(next)) next = startWidth;
          next = Math.max(MIN, Math.min(next, MAX));
          latest = next;
          setLiveWidth(next);
        };

        const onUp = (ev: MouseEvent) => {
          ev.preventDefault();
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);

          if (!Number.isFinite(latest)) return;

          const fullThreshold = containerWidth - 12;
          if (latest >= fullThreshold) {
            // 거의 전체 폭이면 100% 모드
            Transforms.setNodes<TableElement>(
              editor,
              {
                maxWidth: null,
                fullWidth: true,
              } as Partial<TableElement>,
              { at: tablePath },
            );
          } else {
            Transforms.setNodes<TableElement>(
              editor,
              {
                maxWidth: Math.round(latest),
                fullWidth: false,
              } as Partial<TableElement>,
              { at: tablePath },
            );
          }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      };

      const wrapWidth = liveWidth ?? widthFromNode;
      const tableAlign = table.align ?? 'left';

      const wrapStyle: React.CSSProperties = {
        position: 'relative',
        width: wrapWidth ? `${wrapWidth}px` : table.fullWidth ? '100%' : undefined,
        maxWidth: '100%',
      };

      // fullWidth(100%)가 아닌 경우에만 표 자체 정렬 적용
      if (!table.fullWidth) {
        if (tableAlign === 'center') {
          wrapStyle.marginLeft = 'auto';
          wrapStyle.marginRight = 'auto';
        } else if (tableAlign === 'right') {
          wrapStyle.marginLeft = 'auto';
          wrapStyle.marginRight = 0;
        } else {
          // left
          wrapStyle.marginLeft = 0;
          wrapStyle.marginRight = 'auto';
        }
      }

      return (
        <div
          {...attributes}
          ref={wrapRef}
          data-tkey={tkey}
          style={wrapStyle}
          onMouseMoveCapture={(e) => {
            if (isDragPrimedOrActive()) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onMouseUpCapture={(e) => {
            if (isDragPrimedOrActive()) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <table
            className="slate-table"
            onDragStart={(e) => e.preventDefault()}
            style={{
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              width: '100%',
            }}
          >
            <tbody>{children}</tbody>
          </table>

          {/* 드래그 선택 오버레이 */}
          <div
            ref={ovRef}
            contentEditable={false}
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 0,
              height: 0,
              border: '2px solid #2a9d6f',
              borderRadius: 6,
              boxSizing: 'border-box',
              background: 'rgba(42,157,111,.12)',
              pointerEvents: 'none',
              display: 'none',
            }}
          />

          {/* 좌/상단 레일 */}
          <div
            contentEditable={false}
            aria-hidden
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRailLeft(e);
            }}
            style={{
              position: 'absolute',
              left: -14,
              top: 0,
              width: 14,
              height: '100%',
              background: '#eceff3',
              borderRadius: 6,
              userSelect: 'none',
              cursor: 'default',
            }}
          />
          <div
            contentEditable={false}
            aria-hidden
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRailTop(e);
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: -14,
              height: 14,
              width: '100%',
              background: '#eceff3',
              borderRadius: 6,
              userSelect: 'none',
              cursor: 'default',
            }}
          />

          {/* 폭 조절 핸들 */}
          <div
            contentEditable={false}
            aria-hidden
            onMouseDown={onResizeMouseDown}
            style={{
              position: 'absolute',
              right: -6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 12,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'col-resize',
              zIndex: 4,
            }}
          >
            <div
              style={{
                width: 3,
                height: '70%',
                borderRadius: 999,
                background: '#cbd5e1',
              }}
            />
          </div>
        </div>
      );
    }

    case 'table-row': {
      return <tr {...attributes}>{children}</tr>;
    }

    case 'table-cell': {
      const el = element as any;
      const colSpan = Math.max(1, Number(el.colspan) || 1);
      const rowSpan = Math.max(1, Number(el.rowspan) || 1);

      const path = ReactEditor.findPath(editor, element);
      const tablePath = path.slice(0, -2);
      const tkey = tablePathKey(tablePath);
      const { r, c } = { r: path[path.length - 2] as number, c: path[path.length - 1] as number };

      const onDown: React.MouseEventHandler<HTMLTableCellElement> = (e) => {
        if (e.button !== 0) return;       // 좌클릭만
        e.preventDefault();               // 네이티브 선택/드래그 차단
        e.stopPropagation();              // Slate 핸들러로 버블 금지
        beginDrag(editor, tablePath, tkey, r, c, e.clientX, e.clientY);
      };

      const onEnter = () => hoverCell(tkey, r, c);

      const onCtx: React.MouseEventHandler<HTMLTableCellElement> = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent('editor:table-menu', { detail: { x: e.clientX, y: e.clientY, cellPath: path } })
        );
      };

      return (
        <td
          {...attributes}
          data-tkey={tkey}
          data-r={r}
          data-c={c}
          colSpan={colSpan}
          rowSpan={rowSpan}
          onMouseDown={onDown}
          onMouseEnter={onEnter}
          onContextMenu={onCtx}
          onDragStart={(e) => e.preventDefault()}   // 네이티브 HTML drag 이미지 방지
          draggable={false}
          className="slate-table__cell"
          style={{
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            padding: '4px 6px',
            verticalAlign: 'top',
          }}
        >
          {children}
        </td>
      );
    }

    case 'video': {
      const el = element as VideoElement;
      const selected = useSelected();
      const focused = useFocused();
      const [modalOpen, setModalOpen] = useState(false);

      let justifyContent: 'flex-start' | 'center' | 'flex-end' = 'center';
      if (el.textAlign === 'left') justifyContent = 'flex-start';
      else if (el.textAlign === 'right') justifyContent = 'flex-end';

      const handleSaveSize = (width: number, height: number) => {
        const path = ReactEditor.findPath(editor, element);
        Transforms.setNodes(editor, { width, height }, { at: path });
        setModalOpen(false);
      };

      const src = typeof el.url === 'string' && el.url.startsWith('http') ? toProxyUrl(el.url) : el.url;

      return (
        <div {...attributes} style={{ margin: '16px 0' }}>
          <div
            key={el.textAlign || 'center'}
            contentEditable={false}
            style={{ display:'flex', justifyContent, alignItems:'flex-start', minHeight: 40 }}
          >
            <div style={{ position:'relative', display:'inline-block' }}>
              <video
                src={src}
                controls
                playsInline
                preload="metadata"
                style={{
                  maxWidth: el.width ? el.width + 'px' : '90%',
                  height: el.height ? el.height + 'px' : 'auto',
                  borderRadius: 10,
                  boxShadow: '0 2px 12px 0 #0001',
                  background: '#000',
                  display: 'block',
                  outline: selected && focused ? '2px solid #2a90ff' : 'none',
                  transition: 'outline 0.1s',
                }}
              />
              {selected && (
                <button
                  type="button"
                  aria-label="영상 크기 편집"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setModalOpen(true); }}
                  style={{
                    position:'absolute', top:8, right:8, background:'#fff', border:'1.5px solid #2a90ff',
                    borderRadius:'50%', boxShadow:'0 1px 5px #0001', width:32, height:32,
                    display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:1, padding:0
                  }}
                  tabIndex={-1}
                  title="영상 크기 편집"
                >
                  {/* 펜 아이콘 같은거 쓰던 것과 동일하게, 없으면 그냥 '⚙️' */}
                  ⚙️
                </button>
              )}
            </div>
          </div>
          {children}
          <ImageSizeModal  /* 그대로 재사용 */
            open={modalOpen}
            width={el.width}
            height={el.height}
            onSave={handleSaveSize}
            onClose={() => setModalOpen(false)}
          />
        </div>
      );
    }

        // -------------------- Weapon Card (무기 정보 박스) --------------------
    case 'weapon-card': {
      const el = element as WeaponCardElement;
      const isReadOnly = ReactEditor.isReadOnly(editor);

      // 우클릭 삭제 메뉴용 상태
      const [menuOpen, setMenuOpen] = React.useState(false);
      const [menuPos, setMenuPos] = React.useState<{ x: number; y: number }>({
        x: 0,
        y: 0,
      });
      const pathRef = React.useRef<Path | null>(null);
      pathRef.current = ReactEditor.findPath(editor, element);

      // 메뉴 바깥 클릭 / ESC 로 닫기
      React.useEffect(() => {
        if (!menuOpen) return;
        const close = (e: MouseEvent | KeyboardEvent) => {
          if ((e as KeyboardEvent).key && (e as KeyboardEvent).key !== 'Escape') return;
          setMenuOpen(false);
        };
        const click = () => setMenuOpen(false);

        window.addEventListener('keydown', close);
        window.addEventListener('mousedown', click, true);
        window.addEventListener('scroll', click, true);
        return () => {
          window.removeEventListener('keydown', close);
          window.removeEventListener('mousedown', click, true);
          window.removeEventListener('scroll', click, true);
        };
      }, [menuOpen]);

      const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly) return; // 문서 보기 모드에서는 삭제 메뉴 없음
        e.preventDefault();
        e.stopPropagation();
        setMenuPos({ x: e.clientX, y: e.clientY });
        setMenuOpen(true);
      };

      const handleDeleteCard = () => {
        const path = pathRef.current;
        if (!path) return;
        Transforms.removeNodes(editor, { at: path });
        setMenuOpen(false);
      };

      // 이 card 안에서 이미 쓰고 있는 "정보 설정" 핸들러가 있다면 여기에 연결
      // (예: openWeaponInfoModal(el) 같은 함수)
      const handleOpenInfo = () => {
        // TODO: 여기서 기존 정보 설정 모달 여는 로직 호출
        // 예) window.dispatchEvent(new CustomEvent('weapon:open-info', { detail: { id: el.id } }))
      };

      // attack / video 버튼 레이아웃 설명:
      // - "공격 영상 보기" 버튼은 항상 렌더되지만
      //   readOnly일 때는 width 100%, 중앙 정렬
      // - "영상 설정" 버튼은 에디터 모드일 때만 노출
      const renderBottomButtons = () => {
        return (
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              justifyContent: isReadOnly ? 'center' : 'space-between',
            }}
          >
            <button
              type="button"
              style={{
                flex: isReadOnly ? 1 : 1.2,
                padding: '8px 12px',
                borderRadius: 999,
                border: 'none',
                background: '#2563eb',
                color: '#f9fafb',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // TODO: 공격 영상 보기 모달 / 재생 로직
                // (el.videoUrl 을 사용하거나, 따로 선택된 미디어 id 사용)
              }}
            >
              공격 영상 보기
            </button>

            {!isReadOnly && (
              <button
                type="button"
                style={{
                  flex: 0,
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: '1px solid #4b5563',
                  background: '#020617',
                  color: '#e5e7eb',
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // TODO: 영상 설정 모달 열기 (영상 선택 / URL 입력 등)
                }}
              >
                영상 설정
              </button>
            )}
          </div>
        );
      };

      // 활성화된 스탯만 표시
      const activeStats = (el.stats ?? []).filter((s) => s.enabled);

      return (
        <div {...attributes}>
          {/* 우클릭 컨텍스트 메뉴 (에디터 전용) */}
          {!isReadOnly && menuOpen && (
            <div
              contentEditable={false}
              style={{
                position: 'fixed',
                top: menuPos.y,
                left: menuPos.x,
                transform: 'translateY(-6px)',
                background: '#020617',
                borderRadius: 8,
                border: '1px solid #1f2937',
                boxShadow: '0 8px 24px rgba(0,0,0,.45)',
                padding: 4,
                zIndex: 99999,
                minWidth: 120,
              }}
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleDeleteCard}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: '#f97373',
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                무기 박스 삭제
              </button>
            </div>
          )}

          {/* 카드 래퍼: 중앙 정렬 */}
          <div
            contentEditable={false}
            onContextMenu={handleContextMenu}
            style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '18px 0',
            }}
          >
            <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
              {/* 정보 설정 버튼: 카드 바깥 우상단, 에디터에서만 노출 */}
              {!isReadOnly && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleOpenInfo}
                  style={{
                    position: 'absolute',
                    top: -16,
                    right: -4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,.9)',
                    background: '#020617',
                    color: '#e5e7eb',
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(15,23,42,.6)',
                    zIndex: 2,
                  }}
                >
                  정보 설정
                </button>
              )}

              {/* 실제 카드 박스 시작 */}
              <div
                style={{
                  borderRadius: 18,
                  overflow: 'hidden',
                  boxShadow: '0 8px 30px rgba(0,0,0,.45)',
                  background: '#020617',
                  border: '1px solid #1f2937',
                }}
              >
                {/* 상단 레어도 영역 */}
                <div
                  style={{
                    background:
                      el.weaponType === 'epic'
                        ? '#7c3aed'
                        : el.weaponType === 'unique'
                        ? '#38bdf8'
                        : el.weaponType === 'legendary'
                        ? '#f97316'
                        : el.weaponType === 'divine'
                        ? '#ecfeff'
                        : el.weaponType === 'superior'
                        ? '#22c55e'
                        : el.weaponType === 'class'
                        ? '#6366f1'
                        : el.weaponType === 'hidden'
                        ? '#64748b'
                        : el.weaponType === 'limited'
                        ? '#e11d48'
                        : '#facc15',
                    color:
                      el.weaponType === 'divine' ? '#0f172a' : '#f9fafb',
                    textAlign: 'center',
                    fontWeight: 700,
                    padding: '8px 10px',
                    fontSize: 13,
                    letterSpacing: 1.4,
                  }}
                >
                  {el.weaponType?.toUpperCase?.() ?? 'EPIC'}
                </div>

                {/* 이름 영역 */}
                <div
                  style={{
                    padding: '14px 12px 10px',
                    borderBottom: '1px solid rgba(15,23,42,.9)',
                    textAlign: 'center',
                    cursor: isReadOnly ? 'default' : 'pointer',
                  }}
                  onClick={(e) => {
                    if (isReadOnly) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const next = window.prompt('무기 이름을 입력하세요.', el.name ?? '');
                    if (next == null) return;
                    const path = pathRef.current;
                    if (!path) return;
                    Transforms.setNodes<WeaponCardElement>(
                      editor,
                      { name: next },
                      { at: path },
                    );
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#f9fafb',
                    }}
                  >
                    {el.name || '새 무기 이름'}
                  </span>
                </div>

                {/* 이미지 영역 */}
                <div
                  style={{
                    padding: '18px 12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 120,
                    background:
                      'radial-gradient(circle at 20% 0%, #1e293b, #020617)',
                    cursor: isReadOnly ? 'default' : 'pointer',
                  }}
                  onClick={(e) => {
                    if (isReadOnly) return;
                    e.preventDefault();
                    e.stopPropagation();
                    // TODO: 이미지 선택 모달 열기 (이미지 업로드 시스템 연동)
                  }}
                >
                  {el.imageUrl ? (
                    <img
                      src={el.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      style={{
                        maxWidth: 120,
                        maxHeight: 120,
                        imageRendering: 'pixelated',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 13,
                        color: '#6b7280',
                      }}
                    >
                      이미지 없음
                    </span>
                  )}
                </div>

                {/* 스탯 영역 */}
                <div
                  style={{
                    padding: '10px 10px 12px',
                    background: '#020617',
                  }}
                >
                  {activeStats.map((s) => (
                    <div
                      key={s.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 10,
                        background: '#020617',
                        border: '1px solid #111827',
                        color: '#e5e7eb',
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                      onClick={(e) => {
                        if (isReadOnly) return;
                        e.preventDefault();
                        e.stopPropagation();
                        // TODO: 해당 스탯 상세 설정 모달 열기
                      }}
                    >
                      <span>{s.label}</span>
                      <span style={{ opacity: s.summary ? 1 : 0.5 }}>
                        {s.summary || '-'}
                        {s.unit ? (
                          <span style={{ marginLeft: 4 }}>{s.unit}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}

                  {/* 하단 버튼들 */}
                  {renderBottomButtons()}
                </div>
              </div>
            </div>
          </div>

          {children}
        </div>
      );
    }

    // -------------------- 기본 fallback --------------------
    default: {
      const el = element as any;
      const textAlign = 'textAlign' in el ? el.textAlign : 'left';
      if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
        return <span {...attributes}>{children}</span>;
      }
      return (
        <p {...attributes} style={{ textAlign }}>
          {children}
        </p>
      );
    }
  }
};

export default Element;

// -------------------- Weapon Card Modals --------------------

type WeaponTypeSelectModalProps = {
  open: boolean;
  currentType: WeaponType;
  onClose: () => void;
  onSelect: (t: WeaponType) => void;
};

const WeaponTypeSelectModal: React.FC<WeaponTypeSelectModalProps> = ({
  open,
  currentType,
  onClose,
  onSelect,
}) => {
  if (!open) return null;

  const types: WeaponType[] = [
    'epic',
    'unique',
    'legendary',
    'divine',
    'superior',
    'class',
    'hidden',
    'limited',
    'ancient',
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 360,
          maxWidth: '90%',
          borderRadius: 14,
          background: '#020617',
          padding: '16px 18px 14px',
          boxShadow: '0 18px 40px rgba(0,0,0,.55)',
          color: '#e5e7eb',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          무기 유형 선택
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {types.map((t) => {
            const meta = WEAPON_TYPES_META[t];
            const active = t === currentType;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onSelect(t)}
                style={{
                  borderRadius: 999,
                  border: active ? 'none' : '1px solid #1f2937',
                  padding: '6px 0',
                  background: active
                    ? meta.headerBg
                    : 'linear-gradient(90deg,#020617,#020617)',
                  color: active ? '#f9fafb' : '#9ca3af',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1,
                  cursor: 'pointer',
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <div style={{ textAlign: 'right' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: '1px solid #4b5563',
              padding: '5px 14px',
              background: '#020617',
              color: '#e5e7eb',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

type WeaponNameEditModalProps = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
};

const WeaponNameEditModal: React.FC<WeaponNameEditModalProps> = ({
  open,
  initialName,
  onClose,
  onSave,
}) => {
  const [name, setName] = React.useState(initialName || '');

  React.useEffect(() => {
    if (open) setName(initialName || '');
  }, [open, initialName]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '90%',
          borderRadius: 14,
          background: '#020617',
          padding: '18px 20px 16px',
          boxShadow: '0 18px 40px rgba(0,0,0,.55)',
          color: '#e5e7eb',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          무기 이름 수정
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="무기 이름"
          autoFocus
          style={{
            width: '100%',
            borderRadius: 8,
            border: '1px solid #4b5563',
            background: '#020617',
            padding: '8px 10px',
            color: '#e5e7eb',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: '1px solid #4b5563',
              padding: '6px 14px',
              background: '#020617',
              color: '#e5e7eb',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => onSave(name.trim() || '새 무기 이름')}
            style={{
              borderRadius: 999,
              border: 'none',
              padding: '6px 16px',
              background: '#2563eb',
              color: '#f9fafb',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

type WeaponStatEditModalProps = {
  open: boolean;
  weaponType: WeaponType;
  stats: WeaponStatConfig[];
  statKey: WeaponStatKey | null;
  readOnly: boolean;
  onClose: () => void;
  onSave: (nextStat: WeaponStatConfig) => void;
};

const WeaponStatEditModal: React.FC<WeaponStatEditModalProps> = ({
  open,
  weaponType,
  stats,
  statKey,
  readOnly,
  onClose,
  onSave,
}) => {
  if (!open || !statKey) return null;

  const original =
    stats.find((s) => s.key === statKey) ||
    createEmptyWeaponStat(statKey, weaponType, true);

  const [local, setLocal] = React.useState<WeaponStatConfig>(
    {
      ...original,
      levels: normalizeStatLevels(original.levels, weaponType),
    },
  );

  React.useEffect(() => {
    if (!open || !statKey) return;
    const base =
      stats.find((s) => s.key === statKey) ||
      createEmptyWeaponStat(statKey, weaponType, true);
    setLocal({
      ...base,
      levels: normalizeStatLevels(base.levels, weaponType),
    });
  }, [open, statKey, stats, weaponType]);

  const levels = getWeaponLevelLabels(weaponType);

  const handleLevelChange = (idx: number, value: string) => {
    setLocal((prev) => ({
      ...prev,
      levels: prev.levels.map((lv, i) =>
        i === idx ? { ...lv, value } : lv,
      ),
    }));
  };

  const handleSave = () => {
    onSave({
      ...local,
      levels: normalizeStatLevels(local.levels, weaponType),
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: '95%',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 14,
          background: '#020617',
          padding: '18px 20px 16px',
          boxShadow: '0 18px 40px rgba(0,0,0,.55)',
          color: '#e5e7eb',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          무기 정보 편집
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1fr',
            gap: 8,
            marginBottom: 10,
            fontSize: 12,
            color: '#9ca3af',
          }}
        >
          <span>표시 이름</span>
          <span>요약 값</span>
          <span>단위</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1fr',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <input
            value={local.label}
            readOnly={readOnly}
            onChange={(e) =>
              setLocal((p) => ({ ...p, label: e.target.value }))
            }
            style={{
              borderRadius: 8,
              border: '1px solid #4b5563',
              background: readOnly ? '#020617' : '#020617',
              padding: '7px 8px',
              color: '#e5e7eb',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <input
            value={local.summary}
            readOnly={readOnly}
            onChange={(e) =>
              setLocal((p) => ({ ...p, summary: e.target.value }))
            }
            style={{
              borderRadius: 8,
              border: '1px solid #4b5563',
              background: readOnly ? '#020617' : '#020617',
              padding: '7px 8px',
              color: '#e5e7eb',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <input
            value={local.unit ?? ''}
            readOnly={readOnly}
            onChange={(e) =>
              setLocal((p) => ({ ...p, unit: e.target.value }))
            }
            style={{
              borderRadius: 8,
              border: '1px solid #4b5563',
              background: readOnly ? '#020617' : '#020617',
              padding: '7px 8px',
              color: '#e5e7eb',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          강화별 상세 값
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 3fr',
            gap: 6,
          }}
        >
          {levels.map((label, idx) => (
            <React.Fragment key={label}>
              <div
                style={{
                  fontSize: 12,
                  color: '#9ca3af',
                  paddingTop: 4,
                }}
              >
                {label}
              </div>
              <input
                value={local.levels[idx]?.value ?? ''}
                readOnly={readOnly}
                onChange={(e) => handleLevelChange(idx, e.target.value)}
                style={{
                  borderRadius: 8,
                  border: '1px solid #4b5563',
                  background: readOnly ? '#020617' : '#020617',
                  padding: '6px 8px',
                  color: '#e5e7eb',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </React.Fragment>
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: '1px solid #4b5563',
              padding: '6px 14px',
              background: '#020617',
              color: '#e5e7eb',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={handleSave}
              style={{
                borderRadius: 999,
                border: 'none',
                padding: '6px 16px',
                background: '#2563eb',
                color: '#f9fafb',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

type WeaponStatSelectModalProps = {
  open: boolean;
  weaponType: WeaponType;
  stats: WeaponStatConfig[];
  onClose: () => void;
  onSave: (nextStats: WeaponStatConfig[]) => void;
};

const WeaponStatSelectModal: React.FC<WeaponStatSelectModalProps> = ({
  open,
  weaponType,
  stats,
  onClose,
  onSave,
}) => {
  if (!open) return null;

  const base = ensureWeaponStats(stats, weaponType);
  const [local, setLocal] = React.useState<WeaponStatConfig[]>(base);

  React.useEffect(() => {
    if (open) setLocal(ensureWeaponStats(stats, weaponType));
  }, [open, stats, weaponType]);

  const toggle = (key: WeaponStatKey) => {
    setLocal((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, enabled: !s.enabled } : s,
      ),
    );
  };

  const handleSave = () => {
    onSave(local);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: '90%',
          borderRadius: 14,
          background: '#020617',
          padding: '16px 18px 14px',
          boxShadow: '0 18px 40px rgba(0,0,0,.55)',
          color: '#e5e7eb',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          표시할 정보 선택
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#9ca3af',
            marginBottom: 10,
          }}
        >
          데미지 / 쿨타임 / 타수 / 범위 / 지속시간 / 회복량 중에서
          카드에 표시할 항목을 선택합니다.
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginBottom: 12,
          }}
        >
          {local.map((s) => (
            <label
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 2px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={() => toggle(s.key)}
              />
              <span>{WEAPON_STAT_PRESET[s.key].label}</span>
            </label>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: '1px solid #4b5563',
              padding: '5px 14px',
              background: '#020617',
              color: '#e5e7eb',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              borderRadius: 999,
              border: 'none',
              padding: '5px 16px',
              background: '#2563eb',
              color: '#f9fafb',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

type WeaponVideoModalProps = {
  open: boolean;
  url: string;
  onClose: () => void;
};

const WeaponVideoModal: React.FC<WeaponVideoModalProps> = ({
  open,
  url,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 90vw)',
          height: 'min(540px, 60vh)',
          background: '#020617',
          borderRadius: 14,
          boxShadow: '0 20px 50px rgba(0,0,0,.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #111827',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#e5e7eb',
            fontSize: 14,
          }}
        >
          <span>공격 영상</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: '1px solid #4b5563',
              padding: '3px 10px',
              background: '#020617',
              color: '#e5e7eb',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
        <div
          style={{
            flex: 1,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <video
            src={url}
            controls
            controlsList="nodownload"
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background: '#000',
            }}
          />
        </div>
      </div>
    </div>
  );
};
