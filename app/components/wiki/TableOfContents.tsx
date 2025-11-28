// =============================================
// File: app/components/wiki/TableOfContents.tsx
// - 해시 포함 링크로 진입했을 때 스크롤 재시도 로직 유지
// - 사이드바(목차 영역)에서는 링크 복사 버튼 제거
// - 문서 제목/아이콘(docTitle/docIcon) 목차 맨 위에 표시
// - 활성 목차 하이라이트 바 + 목차 패널 자동 스크롤
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
  /** 목차 박스 상단 라벨 (기본: '목차') */
  title?: string;
  /** 문서 제목 (DB 메타에서 오는, 실제 글 제목) */
  docTitle?: string;
  /** 문서 아이콘(이모지 or 이미지 URL). 없으면 첫 heading 아이콘으로 fallback */
  docIcon?: string;
  /** 문서 뷰의 스크롤 컨테이너 선택자(예: '#wiki-scroll-root') */
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
  const rootRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [rootKey, setRootKey] = useState(0); // 루트 변경 트리거 키

  // ✅ TOC 컨테이너
  const tocRef = useRef<HTMLElement | null>(null);

  // ✅ 활성 하이라이트 바
  const headingsListRef = useRef<HTMLUListElement | null>(null);
  const prevTopRef = useRef<number | null>(null);
  const [indicatorTop, setIndicatorTop] = useState(0);
  const [indicatorHeight, setIndicatorHeight] = useState(0);
  const [indicatorDuration, setIndicatorDuration] = useState('160ms');

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
  // 문서 제목을 클릭했을 때 점프할 기준 heading (없으면 null)
  const docTitleAnchor = indexed[0] ?? null;
  const resolvedDocIcon = docIcon ?? docTitleAnchor?.icon ?? undefined;
  const isDocTitleActive =
    !!docTitleAnchor && activeId === docTitleAnchor.id;

  // 스크롤 가능한 조상 자동 탐색
  const findScrollableAncestor = (
    el: HTMLElement | null,
  ): HTMLElement | null => {
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

  // TOC 패널에서 실제 스크롤이 발생하는 엘리먼트
  const getTocScrollContainer = (): HTMLElement | null => {
    if (!tocRef.current) return null;
    // 부모 중 스크롤 가능한 요소가 있으면 우선 사용
    const parentScrollable = findScrollableAncestor(tocRef.current);
    return parentScrollable ?? tocRef.current;
  };

  // root 결정(명시 selector > 자동 > null), 변경 시 rootKey 갱신
  useEffect(() => {
    if (scrollRootSelector) {
      rootRef.current = document.querySelector<HTMLElement>(
        scrollRootSelector,
      );
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

  // 🔍 IntersectionObserver용 root: 실제로 스크롤 가능한 경우에만 사용, 아니면 window 기준(null)
  const getRootForObserver = () => {
    const root = rootRef.current;
    if (!root) return null;
    const { overflowY } = getComputedStyle(root);
    const canScroll =
      /(auto|scroll)/.test(overflowY) &&
      root.scrollHeight > root.clientHeight + 1;
    return canScroll ? root : null;
  };

  // 타겟 찾기(동일 id의 n번째)
  const getTarget = (id: string, occ: number) => {
    const esc = id.replace(/"/g, '\\"');
    const list = document.querySelectorAll<HTMLElement>(`[id="${esc}"]`);
    return list[occ] ?? list[0] ?? null;
  };

  // 🔥 실제로 스크롤에 사용할 루트 결정
  const getScrollRoot = (target: HTMLElement | null): HTMLElement | null => {
    if (!target) return rootRef.current;

    // 1순위: rootRef.current 가 실제로 스크롤 가능한 경우
    if (rootRef.current) {
      const { overflowY } = getComputedStyle(rootRef.current);
      const canScroll =
        /(auto|scroll)/.test(overflowY) &&
        rootRef.current.scrollHeight >
          rootRef.current.clientHeight + 1;
      if (canScroll) return rootRef.current;
    }

    // 2순위: 타겟 기준으로 스크롤 가능한 조상 자동 탐색
    return findScrollableAncestor(target);
  };

  // 컨테이너 기준 스무스 스크롤
  const scrollToId = (
    id: string,
    occ: number,
    behavior: ScrollBehavior = 'smooth',
  ): boolean => {
    const target = getTarget(id, occ);
    if (!target) return false;

    const root = getScrollRoot(target);

    if (!root) {
      // window 스크롤
      const y =
        target.getBoundingClientRect().top +
        window.scrollY -
        headerOffset;
      window.scrollTo({ top: y, behavior });
    } else {
      // 컨테이너 스크롤
      const rootRect = root.getBoundingClientRect();
      const y =
        target.getBoundingClientRect().top -
        rootRect.top +
        root.scrollTop -
        headerOffset;
      root.scrollTo({ top: y, behavior });
    }

    // 🔁 URL 해시는 간단하게 '#id'만 갱신 (path/query는 그대로 유지)
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

  // 스크롤 스파이(컨테이너 기준)
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
          setActiveId((visible[0].target as HTMLElement).id);
        }
      },
      {
        root: getRootForObserver(),
        rootMargin: `-${headerOffset + 8}px 0px -70% 0px`,
        threshold: [0, 1],
      },
    );
    observerRef.current = obs;

    // 동일 id 전부 observe
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

  // 새 문서 로드 + 해시가 있을 때 해당 위치로 여러 번 재시도하며 스크롤
  useEffect(() => {
    if (!headings.length) return;

    const rawHash = window.location.hash || '';
    if (!rawHash) return;

    const hash = decodeURIComponent(rawHash).replace(/^#/, '');
    if (!hash) return;

    const raf = requestAnimationFrame(() => {
      // 한 번에 안 잡히는 경우를 대비해 약간의 딜레이를 두고 최대 3회 시도
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

  // ✅ [1] 활성 목차 하이라이트 바 + ✅ [2] TOC 자동 스크롤
  useEffect(() => {
    if (!headingsListRef.current) return;

    // 현재 파란 글자가 들어간 버튼(aria-current="true")을 직접 찾는다.
    const activeBtn =
      headingsListRef.current.querySelector<HTMLButtonElement>(
        'button[aria-current="true"]',
      );
    if (!activeBtn) return;

    const newTop = activeBtn.offsetTop;
    const newHeight = activeBtn.offsetHeight;

    const prevTop = prevTopRef.current ?? newTop;
    prevTopRef.current = newTop;

    // 거리(px)에 비례해서 속도 조정
    const distance = Math.abs(newTop - prevTop);
    const base = 90; // ms
    const perPx = 0.4; // px당 추가 시간
    const duration = Math.min(650, base + distance * perPx);

    setIndicatorTop(newTop);
    setIndicatorHeight(newHeight);
    setIndicatorDuration(`${duration}ms`);

    // ✅ TOC 패널 스크롤도 같이 맞춰준다.
    const container = getTocScrollContainer();
    if (!container) return;

    const padding = 24; // 위/아래 여유
    // headingsListRef 자체의 offsetTop 을 포함해서, 컨테이너 기준 좌표로 환산
    const listOffset = headingsListRef.current.offsetTop || 0;
    const elementTop = listOffset + newTop;
    const elementBottom = elementTop + newHeight;

    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    if (elementTop < viewTop + padding) {
      container.scrollTo({
        top: Math.max(0, elementTop - padding),
        behavior: 'smooth',
      });
    } else if (elementBottom > viewBottom - padding) {
      const nextTop = elementBottom - container.clientHeight + padding;
      container.scrollTo({
        top: Math.max(0, nextTop),
        behavior: 'smooth',
      });
    }
  }, [activeId]);

  // ----- UI 스타일 -----
  // 👉 여기서는 fixed/overflowY 는 최소한만 잡고,
  // 실제 레이아웃/스크롤은 .wiki-toc-sidebar 같은 바깥 컨테이너가 담당해도 된다.
  const boxStyle: React.CSSProperties = {
    // 레이아웃에서 독립적으로 쓰고 싶을 때를 대비해 기본값만 남겨둠
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

  // 문서 제목용 스타일 (heading-one 느낌)
  const docTitleIconBox: React.CSSProperties = {
    width: 22,
    height: 22,
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    marginRight: 8,
  };

  const docTitleTextStyle: React.CSSProperties = {
    fontSize: 18, // heading-one 대비 사이드바용 축소
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

  // ----- headings/제목 둘 다 없을 때 -----
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

  // ----- 실제 렌더 -----
  return (
    <aside
      ref={tocRef}
      role="navigation"
      aria-label="Table of contents"
      style={boxStyle}
    >
      {/* 상단 "목차" 라벨 */}
      <p style={titleStyle}>
        <FontAwesomeIcon icon={faAlignLeft} />
        &nbsp;&nbsp;{title}
      </p>

      {/* 문서 제목 블록 */}
      <ul style={listStyle}>
        {/* 🔹 문서 제목(현재 글의 title/icon) – 목차 맨 위에 한 번 표시 */}
        {hasDocTitle && (
          <li key="__doc-title" style={{ marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => {
                if (docTitleAnchor) {
                  // 첫 heading 위치로 이동
                  scrollToId(docTitleAnchor.id, docTitleAnchor.__occ);
                } else {
                  // heading 이 하나도 없으면 상단으로 스크롤
                  const root = rootRef.current;
                  if (!root) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    root.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }
              }}
              title={docTitle}
              aria-current={isDocTitleActive ? 'true' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                cursor: 'pointer',
                border: 0,
                background: isDocTitleActive ? '#eff6ff' : 'transparent',
                borderLeft: `3px solid ${
                  isDocTitleActive ? '#2563eb' : 'transparent'
                }`,
                color: isDocTitleActive ? '#111827' : '#0f172a',
                padding: '8px 8px',
                paddingLeft: 8,
                borderRadius: 10,
                textAlign: 'left',
                marginBottom: 4,
                transition:
                  'background .12s, color .12s, border-color .12s',
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
      </ul>

      {/* 🔹 실제 목차 항목들 (본문 heading 들) + 하이라이트 바 */}
      <ul
        ref={headingsListRef}
        style={{
          ...listStyle,
          position: 'relative',
          marginTop: hasDocTitle ? 4 : 0,
        }}
      >
        {/* 활성 하이라이트 바 – 실제 활성 버튼 위치로 슬라이드 */}
        {indicatorHeight > 0 && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: indicatorTop,
              height: indicatorHeight,
              borderRadius: 8,
              background: '#eff6ff',
              borderLeft: '3px solid #2563eb',
              zIndex: 0,
              transitionProperty: 'top,height',
              transitionDuration: indicatorDuration,
              transitionTimingFunction: 'cubic-bezier(0.25,0.8,0.25,1)',
            }}
          />
        )}

        {indexed.map((h, i) => {
          const active = h.id === activeId;
          const padLeft = h.level === 1 ? 8 : h.level === 2 ? 26 : 44;

          return (
            <li
              key={`${h.id}-${h.__occ}-${i}`}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <button
                type="button"
                data-toc-index={i}
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
                  background: 'transparent',
                  borderLeft: '3px solid transparent',
                  color: active ? '#2563eb' : '#4b5563',
                  padding: '6px 8px',
                  paddingLeft: padLeft,
                  borderRadius: 8,
                  textAlign: 'left',
                  transition: 'color .12s',
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
