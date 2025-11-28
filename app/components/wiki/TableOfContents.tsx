// =============================================
// File: app/components/wiki/TableOfContents.tsx
// - 해시 포함 링크로 진입했을 때 스크롤 재시도 로직 유지
// - 사이드바(목차 영역)에서는 링크 복사 버튼 제거
// - 문서 제목/아이콘(docTitle/docIcon) 목차 맨 위에 표시
// - 활성 목차 슬라이딩 하이라이트 + TOC 자동 스크롤
// =============================================
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAlignLeft } from '@fortawesome/free-solid-svg-icons';
import { toProxyUrl } from '@lib/cdn';

type Heading = {
  text: string;
  id: string;
  level: 1 | 2 | 3;
  icon?: string;
};

type Props = {
  headings: Heading[];
  headerOffset?: number;
  right?: number;
  top?: number;
  width?: number;
  title?: string;
  docTitle?: string;
  docIcon?: string;
  scrollRootSelector?: string;
};

export default function TableOfContents({
  headings,
  headerOffset = 72,
  right = 20,
  top = 100,
  width = 230,
  title = '목차',
  docTitle,
  docIcon,
  scrollRootSelector,
}: Props) {
  const [activeId, setActiveId] = useState<string>('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const rootRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [rootKey, setRootKey] = useState(0);

  // TOC 전체 박스
  const tocRef = useRef<HTMLElement | null>(null);
  // heading 버튼이 들어있는 UL
  const headingsListRef = useRef<HTMLUListElement | null>(null);

  // 슬라이딩 하이라이트 상태
  const prevTopRef = useRef<number | null>(null);
  const [indicatorTop, setIndicatorTop] = useState(0);
  const [indicatorHeight, setIndicatorHeight] = useState(0);
  const [indicatorDuration, setIndicatorDuration] = useState('140ms');

  // 동일 id에 발생 순번 부여
  const indexed = useMemo(() => {
    const seen: Record<string, number> = {};
    return headings.map(h => {
      const occ = seen[h.id] ?? 0;
      seen[h.id] = occ + 1;
      return { ...h, __occ: occ } as Heading & { __occ: number };
    });
  }, [headings]);

  const hasDocTitle = !!(docTitle && docTitle.trim());
  const docTitleAnchor = indexed[0] ?? null;
  const resolvedDocIcon = docIcon ?? docTitleAnchor?.icon ?? undefined;

  // ===== 유틸 =====

  const findScrollableAncestor = (el: HTMLElement | null): HTMLElement | null => {
    let cur: HTMLElement | null = el?.parentElement ?? null;
    while (cur) {
      const { overflowY } = getComputedStyle(cur);
      const canScroll =
        /(auto|scroll)/.test(overflowY) &&
        cur.scrollHeight > cur.clientHeight + 1;
      if (canScroll) return cur;
      cur = cur.parentElement;
    }
    return null;
  };

  const getTocScrollContainer = (): HTMLElement | null => {
    if (!tocRef.current) return null;
    const parent = findScrollableAncestor(tocRef.current);
    return parent ?? tocRef.current;
  };

  // ✅ 문서 제목 클릭 시: 본문 스크롤 루트를 맨 위로 올리는 헬퍼
  const scrollToTopOfDocument = React.useCallback(() => {
    if (typeof window === 'undefined') return;

    let root: HTMLElement | null = null;

    // 1순위: props로 받은 scrollRootSelector (예: '#wiki-scroll-root')
    if (scrollRootSelector) {
      root = document.querySelector<HTMLElement>(scrollRootSelector);
    }

    // 2순위: 이미 찾아둔 rootRef (본문 스크롤 컨테이너)
    if (!root && rootRef.current) {
      root = rootRef.current;
    }

    // ⚠ root가 있어도 실제로 스크롤이 안 걸려 있을 수 있으니 검사
    if (root) {
      const { overflowY } = getComputedStyle(root);
      const canScroll =
        /(auto|scroll)/.test(overflowY) &&
        root.scrollHeight > root.clientHeight + 1;

      if (canScroll) {
        root.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // 여기까지 왔다는 건 root가 없거나, 있어도 스크롤 컨테이너가 아님
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollRootSelector]);
  
  // 문서 스크롤 root 결정
  useEffect(() => {
    if (scrollRootSelector) {
      rootRef.current = document.querySelector<HTMLElement>(scrollRootSelector);
      setRootKey(k => k + 1);
      return;
    }

    if (headings.length) {
      const firstId = headings[0].id ?? '';
      const esc = (firstId || '').replace(/"/g, '\\"');
      const first = document.querySelector<HTMLElement>(`[id="${esc}"]`);
      rootRef.current = findScrollableAncestor(first) || null;
      setRootKey(k => k + 1);
    } else {
      rootRef.current = null;
      setRootKey(k => k + 1);
    }
  }, [scrollRootSelector, headings]);

  const getRootForObserver = () => {
    const root = rootRef.current;
    if (!root) return null;
    const { overflowY } = getComputedStyle(root);
    const canScroll =
      /(auto|scroll)/.test(overflowY) &&
      root.scrollHeight > root.clientHeight + 1;
    return canScroll ? root : null;
  };

  const getTarget = (id: string, occ: number) => {
    const esc = id.replace(/"/g, '\\"');
    const list = document.querySelectorAll<HTMLElement>(`[id="${esc}"]`);
    return list[occ] ?? list[0] ?? null;
  };

  const getScrollRoot = (target: HTMLElement | null): HTMLElement | null => {
    if (!target) return rootRef.current;

    if (rootRef.current) {
      const { overflowY } = getComputedStyle(rootRef.current);
      const canScroll =
        /(auto|scroll)/.test(overflowY) &&
        rootRef.current.scrollHeight >
          rootRef.current.clientHeight + 1;
      if (canScroll) return rootRef.current;
    }

    return findScrollableAncestor(target);
  };

  const scrollToId = (
    id: string,
    occ: number,
    behavior: ScrollBehavior = 'smooth',
  ): boolean => {
    const target = getTarget(id, occ);
    if (!target) return false;

    const root = getScrollRoot(target);

    if (!root) {
      const y =
        target.getBoundingClientRect().top +
        window.scrollY -
        headerOffset;
      window.scrollTo({ top: y, behavior });
    } else {
      const rootRect = root.getBoundingClientRect();
      const y =
        target.getBoundingClientRect().top -
        rootRect.top +
        root.scrollTop -
        headerOffset;
      root.scrollTo({ top: y, behavior });
    }

    try {
      const hashId = target.id || id;
      history.replaceState(null, '', `#${hashId}`);
    } catch {
      // ignore
    }

    try {
      window.dispatchEvent(
        new CustomEvent('editor:toc-jump', { detail: { id, occ } }),
      );
    } catch {
      // ignore
    }

    return true;
  };

  // ===== 스크롤 스파이 =====
  useEffect(() => {
    if (!indexed.length) return;

    observerRef.current?.disconnect();
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) =>
            a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1,
          );
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).id;
          setActiveId(id);
          const idx = indexed.findIndex(h => h.id === id);
          if (idx !== -1) setActiveIndex(idx);
        }
      },
      {
        root: getRootForObserver(),
        rootMargin: `-${headerOffset + 8}px 0px -70% 0px`,
        threshold: [0, 1],
      },
    );
    observerRef.current = obs;

    const observed: HTMLElement[] = [];
    const seenIds = new Set<string>();
    indexed.forEach(({ id }) => {
      if (seenIds.has(id)) return;
      seenIds.add(id);
      const esc = id.replace(/"/g, '\\"');
      document
        .querySelectorAll<HTMLElement>(`[id="${esc}"]`)
        .forEach(el => {
          obs.observe(el);
          observed.push(el);
        });
    });

    return () => {
      observed.forEach(el => obs.unobserve(el));
      obs.disconnect();
    };
  }, [indexed, headerOffset, rootKey]);

  // ===== 해시 초기 스크롤 =====
  useEffect(() => {
    if (!headings.length) return;

    const rawHash = window.location.hash || '';
    if (!rawHash) return;

    const hash = decodeURIComponent(rawHash).replace(/^#/, '');
    if (!hash) return;

    const raf = requestAnimationFrame(() => {
      if (scrollToId(hash, 0, 'auto')) return;
      setTimeout(() => {
        if (scrollToId(hash, 0, 'auto')) return;
        setTimeout(() => {
          scrollToId(hash, 0, 'auto');
        }, 180);
      }, 120);
    });
    return () => cancelAnimationFrame(raf);
  }, [headings, rootKey]);

  // ===== 하이라이트 + TOC 자동 스크롤 =====
  useEffect(() => {
    if (activeIndex < 0) return;
    if (!headingsListRef.current) return;

    const btn = headingsListRef.current.querySelector<HTMLButtonElement>(
      `button[data-toc-index="${activeIndex}"]`,
    );
    if (!btn) return;

    const list = headingsListRef.current;
    const listRect = list.getBoundingClientRect();
    const itemRect = btn.getBoundingClientRect();

    const newTop = itemRect.top - listRect.top;
    const newHeight = itemRect.height;

    const prevTop = prevTopRef.current ?? newTop;
    prevTopRef.current = newTop;

    const distance = Math.abs(newTop - prevTop);
    const base = 100;
    const perPx = 0.45;
    const duration = Math.min(700, base + distance * perPx);

    setIndicatorTop(newTop);
    setIndicatorHeight(newHeight);
    setIndicatorDuration(`${duration}ms`);

    const container = getTocScrollContainer();
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    const elementTop =
      itemRect.top - containerRect.top + container.scrollTop;
    const elementBottom =
      itemRect.bottom - containerRect.top + container.scrollTop;

    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const padding = 24;

    if (elementTop < viewTop + padding) {
      container.scrollTo({
        top: Math.max(0, elementTop - padding),
        behavior: 'smooth',
      });
    } else if (elementBottom > viewBottom - padding) {
      const nextTop =
        elementBottom - container.clientHeight + padding;
      container.scrollTo({
        top: Math.max(0, nextTop),
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  // ===== 스타일 =====
  const boxStyle: React.CSSProperties = {
    position: 'fixed',
    right,
    top,
    width,
    background: '#fff',
    border: '1px solid #eef1f5',
    borderRadius: 12,
    boxShadow: '0 2px 14px rgba(0,0,0,.05)',
    padding: '12px 10px',
    zIndex: 50,
    maxHeight: `calc(100vh - ${top + 20}px)`,
    overflowY: 'auto',
  };
  const listStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };
  const iconBox: React.CSSProperties = {
    width: 18,
    height: 18,
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    marginRight: 8,
  };
  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 10px 8px',
  };
  const textStyle: React.CSSProperties = {
    fontSize: 13.5,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const docTitleIconBox: React.CSSProperties = {
    width: 22,
    height: 22,
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    marginRight: 8,
  };

  const docTitleTextStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.3px',
    lineHeight: 1.3,
    whiteSpace: 'normal',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  };

  // ===== 목차 없음 =====
  if (!indexed.length && !hasDocTitle) {
    return (
      <aside
        ref={tocRef}
        role="navigation"
        aria-label="Table of contents"
        style={{
          ...boxStyle,
          display: 'grid',
          placeItems: 'center',
          color: '#9aa1ad',
        }}
      >
        목차 없음
      </aside>
    );
  }

  // ===== 렌더 =====
  return (
    <aside role="navigation" aria-label="Table of contents" style={boxStyle}>
      <p style={titleStyle}>
        <FontAwesomeIcon icon={faAlignLeft} />
        &nbsp;&nbsp;{title}
      </p>

      <ul style={listStyle}>
        {/* 🔹 문서 제목 버튼 */}
        {hasDocTitle && (
          <li key="__doc-title" style={{ marginBottom: 6 }}>
            <button
              type="button"
              onClick={scrollToTopOfDocument}
              title={docTitle}
              // ✅ 제목은 강조/라인 없음: 그냥 정보용 헤더 느낌
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                cursor: 'pointer',
                border: 0,
                background: 'transparent',
                borderLeft: '3px solid transparent',
                color: '#0f172a',
                padding: '8px 8px',
                paddingLeft: 8,
                borderRadius: 10,
                textAlign: 'left',
                marginBottom: 4,
              }}
            >
              <span style={docTitleIconBox} aria-hidden>
                {resolvedDocIcon?.startsWith('http') ? (
                  <img
                    src={toProxyUrl(resolvedDocIcon)}
                    alt=""
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={{
                      width: 20,
                      height: 20,
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                ) : resolvedDocIcon ? (
                  <span
                    style={{
                      fontSize: 18,
                      lineHeight: 1,
                      display: 'block',
                    }}
                  >
                    {resolvedDocIcon}
                  </span>
                ) : null}
              </span>
              <span style={docTitleTextStyle}>{docTitle}</span>
            </button>
          </li>
        )}

        {/* 🔹 실제 목차 항목들 (본문 heading 들) */}
        {indexed.map((h, i) => {
          const active = h.id === activeId;
          const padLeft = h.level === 1 ? 8 : h.level === 2 ? 26 : 44;

          return (
            <li key={`${h.id}-${h.__occ}-${i}`}>
              <button
                type="button"
                onClick={() => scrollToId(h.id, h.__occ)}
                title={h.text}
                aria-current={active ? 'true' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  cursor: 'pointer',
                  border: 0,
                  background: active ? '#eff6ff' : 'transparent',
                  borderLeft: `3px solid ${
                    active ? '#2563eb' : 'transparent'
                  }`,
                  color: active ? '#2563eb' : '#4b5563',
                  padding: '6px 8px',
                  paddingLeft: padLeft,
                  borderRadius: 8,
                  textAlign: 'left',
                  transition:
                    'background .12s, color .12s, border-color .12s',
                }}
              >
                <span style={iconBox} aria-hidden>
                  {h.icon?.startsWith('http') ? (
                    <img
                      src={toProxyUrl(h.icon)}
                      alt=""
                      width={16}
                      height={16}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      style={{
                        width: 16,
                        height: 16,
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  ) : h.icon ? (
                    <span
                      style={{
                        fontSize: 14,
                        lineHeight: 1,
                        display: 'block',
                      }}
                    >
                      {h.icon}
                    </span>
                  ) : null}
                </span>
                <span style={textStyle}>{h.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
