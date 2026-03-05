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
  domId?: string;
  occ?: number;
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
    return headings.map((h) => {
      const occ = h.occ ?? (seen[h.id] ?? 0);
      seen[h.id] = occ + 1;
      const domId = h.domId ?? `${h.id}--${occ}`;
      return { ...h, occ, domId };
    });
  }, [headings]);

  const [activeDomId, setActiveDomId] = useState("");

  // ✅ DOM target 찾기: domId로 단일 조회
  const getTargetByDomId = (domId: string) => {
    return document.getElementById(domId);
  };

  const pickClosestDomId = (): { domId: string; index: number } | null => {
    if (!indexed.length) return null;

    const root = getScrollRootEl(); // HTMLElement | null (scroll-root면 HTMLElement)
    const baseScrollTop = root ? root.scrollTop : window.scrollY;

    // ✅ "컨테이너 기준" 헤더 라인 (scrollTop 좌표계)
    const baseLine = baseScrollTop + headerOffset + 8;

    // 각 heading의 "컨테이너 기준 Y" 계산
    const items = indexed
      .map((h, i) => {
        const el = document.getElementById(h.domId!);
        if (!el) return null;

        const y = getYInScrollRoot(el, root); // ✅ 컨테이너 기준
        return { domId: h.domId!, index: i, delta: y - baseLine };
      })
      .filter(Boolean) as { domId: string; index: number; delta: number }[];

    if (!items.length) return null;

    // 1) baseLine "위(지나온)" 중 가장 가까운 것(0에 가장 가까운 음수)
    let bestAbove: typeof items[number] | null = null;
    for (const it of items) {
      if (it.delta <= 0) {
        if (!bestAbove || it.delta > bestAbove.delta) bestAbove = it;
      }
    }
    if (bestAbove) return { domId: bestAbove.domId, index: bestAbove.index };

    // 2) 위에 없으면(맨 위) 아래 중 가장 가까운 것(가장 작은 양수)
    let bestBelow = items[0];
    for (const it of items) {
      if (it.delta < bestBelow.delta) bestBelow = it;
    }
    return { domId: bestBelow.domId, index: bestBelow.index };
  };

  // ✅ intersect가 없어도(로드 직후/최상단) "가장 가까운 heading"을 강제로 계산해서 active 세팅
  const setActiveByClosest = () => {
    if (!indexed.length) return false;

    const root = getRootForObserver();
    const rootRectTop = root ? root.getBoundingClientRect().top : 0;
    const headerLine = rootRectTop + headerOffset + 8;

    let bestDomId = "";
    let bestScore = Number.POSITIVE_INFINITY;
    let bestIndex = -1;

    for (let i = 0; i < indexed.length; i++) {
      const domId = indexed[i].domId!;
      const el = getTargetByDomId(domId);
      if (!el) continue;

      const top = el.getBoundingClientRect().top;

      const dist = top - headerLine;
      const priority = dist >= 0 ? 0 : 1;
      const score = priority * 1_000_000 + Math.abs(dist);

      if (score < bestScore) {
        bestScore = score;
        bestDomId = domId;
        bestIndex = i;
      }
    }

    if (bestDomId) {
      setActiveDomId(bestDomId);
      if (bestIndex !== -1) setActiveIndex(bestIndex);
      return true;
    }

    return false;
  };

  const hasDocTitle = !!(docTitle && docTitle.trim());
  const docTitleAnchor = indexed[0] ?? null;
  const resolvedDocIcon = docIcon ?? docTitleAnchor?.icon ?? undefined;

  // ===== 유틸 =====

  useEffect(() => {
    // headings가 없으면 이전 문서에서 남은 highlight가 "빈 공간"에 표시될 수 있음
    if (!headings || headings.length === 0) {
      setActiveId('');
      setActiveIndex(-1);

      prevTopRef.current = null;
      setIndicatorTop(0);
      setIndicatorHeight(0);
      setIndicatorDuration('140ms');

      observerRef.current?.disconnect();
    }
  }, [headings]);

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

  const getScrollRootEl = () => {
    return rootRef.current; // selector로 잡힌 #wiki-scroll-root를 그대로 사용
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

  const scrollToDomId = (domId: string, behavior: ScrollBehavior = "smooth"): boolean => {
    const target = getTargetByDomId(domId);
    if (!target) return false;

    const root = getScrollRoot(target);
    if (!root) {
      const y = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: y, behavior });
    } else {
      const rootRect = root.getBoundingClientRect();
      const y = target.getBoundingClientRect().top - rootRect.top + root.scrollTop - headerOffset;
      root.scrollTo({ top: y, behavior });
    }

    try {
      const st = window.history.state; // ✅ Next가 넣은 state 유지
      const url = new URL(window.location.href);
      url.hash = `#${domId}`;
      window.history.replaceState(st, "", url.toString());
    } catch {}

    const idx = indexed.findIndex((h) => h.domId === domId);
    setActiveDomId(domId);
    if (idx !== -1) setActiveIndex(idx);

    return true;
  };

  // ✅ root 결정: 첫 domId 기준으로 찾기
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const maxTries = 60; // ~1초 내외

    const resolve = () => {
      tries += 1;

      // 1) selector 우선
      if (scrollRootSelector) {
        const sel = document.querySelector(scrollRootSelector) as HTMLElement | null;
        if (sel) {
          rootRef.current = sel;
          setRootKey((k) => k + 1);
          return;
        }
        // selector가 아직 DOM에 없으면 재시도
        if (tries < maxTries) raf = requestAnimationFrame(resolve);
        return;
      }

      // 2) 첫 heading DOM 기준
      if (indexed.length) {
        const firstDomId = indexed[0].domId!;
        const first = document.getElementById(firstDomId);

        if (first) {
          rootRef.current = findScrollableAncestor(first) || null;
          setRootKey((k) => k + 1);
          return;
        }

        // heading DOM이 아직 없으면 재시도
        if (tries < maxTries) raf = requestAnimationFrame(resolve);
        return;
      }

      // 3) headings가 아예 없으면 초기화
      rootRef.current = null;
      setRootKey((k) => k + 1);
    };

    raf = requestAnimationFrame(resolve);

    return () => cancelAnimationFrame(raf);
  }, [scrollRootSelector, indexed]);

  useEffect(() => {
    if (!indexed.length) return;

    const root = getScrollRootEl(); // ✅ canScroll 검사 없이 "그냥" root 사용
    let raf = 0;

    const apply = () => {
      const picked = pickClosestDomId();
      if (!picked) return;
      setActiveDomId(picked.domId);
      setActiveIndex(picked.index);
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    // ✅ 로드 직후 2프레임 뒤 한 번 계산
    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });

    // ✅ 핵심: 스크롤 이벤트는 "무조건 root"에 붙인다
    // (root가 아직 안 잡혔으면 window에도 붙여서 안전망)
    root?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    // ✅ 내용 높이/레이아웃 변화(이미지 로딩 등)에도 갱신되게 ResizeObserver 추가
    const ro = root
      ? new ResizeObserver(() => onScroll())
      : null;
    if (root && ro) ro.observe(root);

    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(raf);
      root?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      if (root && ro) ro.disconnect();
    };
  }, [indexed, headerOffset, rootKey]);

  // ✅ 해시 초기 스크롤: 구형(#heading-xxx)도 호환
  useEffect(() => {
    if (!indexed.length) return;

    const rawHash = window.location.hash || "";
    if (!rawHash) return;

    const hash = decodeURIComponent(rawHash).replace(/^#/, "");
    if (!hash) return;

    const tryScroll = (h: string) => {
    const ok = scrollToDomId(h, "auto");
      if (ok) {
        // ✅ 스크롤 성공한 domId를 바로 active로 맞춰준다 (IO 기다리지 않음)
        setActiveDomId(h);
        const idx = indexed.findIndex((x) => x.domId === h);
        if (idx !== -1) setActiveIndex(idx);
      }
      return ok;
    };

    const raf = requestAnimationFrame(() => {
      // 1) 정확 매칭 (#heading-xxx--n)
      if (tryScroll(hash)) return;

      // 2) 구형 링크 (#heading-xxx) → --0로 보정
      if (!hash.includes("--") && tryScroll(`${hash}--0`)) return;

      // 기존 재시도 패턴 유지
      setTimeout(() => {
        if (tryScroll(hash)) return;
        if (!hash.includes("--") && tryScroll(`${hash}--0`)) return;
        setTimeout(() => {
          tryScroll(hash);
          if (!hash.includes("--")) tryScroll(`${hash}--0`);
        }, 180);
      }, 120);
    });

    return () => cancelAnimationFrame(raf);
  }, [indexed, rootKey]);

  // ✅ 렌더 부분: active 비교 + 클릭은 domId로
  // (map 부분의 active / onClick만 수정)
  {indexed.map((h, i) => {
    const active = h.domId === activeDomId;
    const padLeft = h.level === 1 ? 8 : h.level === 2 ? 26 : 44;

    return (
      <li key={h.domId}>
        <button
          data-toc-index={i}
          onClick={() => scrollToDomId(h.domId!)}
          aria-current={active ? "true" : undefined}
          style={{
            // ... 기존 스타일 유지
            paddingLeft: padLeft,
            color: active ? "#2563eb" : "#4b5563",
          }}
          title={h.text}
        >
          {/* 기존 아이콘/텍스트 유지 */}
          {h.text}
        </button>
      </li>
    );  
  })}

  // ===== 하이라이트 + TOC 자동 스크롤 =====
  useEffect(() => {
    if (!indexed.length) return;
    if (activeIndex < 0) return;
    if (activeIndex >= indexed.length) return;
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

  function getYInScrollRoot(el: HTMLElement, root: HTMLElement | null) {
    if (!root) {
      return el.getBoundingClientRect().top + window.scrollY;
    }
    const rootRect = root.getBoundingClientRect();
    return el.getBoundingClientRect().top - rootRect.top + root.scrollTop;
  }

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
    width: 24,
    height: 24,
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
  if (!indexed.length) {
    return (
      <aside
        ref={tocRef}
        role="navigation"
        aria-label="Table of contents"
        style={{
          ...boxStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <p style={titleStyle}>
          <FontAwesomeIcon icon={faAlignLeft} />
          &nbsp;&nbsp;{title}
        </p>

        {hasDocTitle ? (
          <button
            type="button"
            onClick={() => {
              const root = rootRef.current;
              if (!root) window.scrollTo({ top: 0, behavior: 'smooth' });
              else root.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title={docTitle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              cursor: 'pointer',
              border: 0,
              background: 'transparent',
              borderRadius: 10,
              textAlign: 'left',
              padding: '8px 8px',
            }}
          >
            <span style={docTitleIconBox} aria-hidden>
              {resolvedDocIcon?.startsWith('http') ? (
                <img
                  src={toProxyUrl(resolvedDocIcon)}
                  alt=""
                  width={24}
                  height={24}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{ width: 24, height: 24, objectFit: 'contain', display: 'block' }}
                />
              ) : resolvedDocIcon ? (
                <span style={{ fontSize: 18, lineHeight: 1, display: 'block' }}>
                  {resolvedDocIcon}
                </span>
              ) : null}
            </span>
            <span style={docTitleTextStyle}>{docTitle}</span>
          </button>
        ) : null}

        <div
          style={{
            marginTop: 4,
            color: '#9aa1ad',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            padding: '14px 8px',
            borderRadius: 10,
            background: '#fafbfc',
            border: '1px dashed #e5e7eb',
          }}
        >
          목차 없음
        </div>
      </aside>
    );
  }

  // ===== 렌더 =====
  return (
    <aside
      ref={tocRef}
      role="navigation"
      aria-label="Table of contents"
      style={boxStyle}
    >
      <p style={titleStyle}>
        <FontAwesomeIcon icon={faAlignLeft} />
        &nbsp;&nbsp;{title}
      </p>

      {/* 문서 제목 블록 (항상 고정 스타일, 활성화 없음) */}
      <ul style={listStyle}>
        {hasDocTitle && (
          <li key="__doc-title" style={{ marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => {
                // ✅ 무조건 문서 맨 위로 스크롤
                const root = rootRef.current;
                if (!root) {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  root.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              title={docTitle}
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
                    width={24}
                    height={24}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={{
                      width: 24,
                      height: 24,
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

      {/* 실제 목차 항목들 + 슬라이딩 하이라이트 */}
      <ul
        ref={headingsListRef}
        style={{
          ...listStyle,
          position: 'relative',
          marginTop: hasDocTitle ? 4 : 0,
        }}
      >
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
              transitionProperty: 'top, height',
              transitionDuration: indicatorDuration,
              transitionTimingFunction: 'cubic-bezier(0.25,0.8,0.25,1)',
            }}
          />
        )}

        {indexed.map((h, i) => {
          const active = h.domId === activeDomId;
          const padLeft = h.level === 1 ? 8 : h.level === 2 ? 26 : 44;

          return (
            <li
              key={h.domId}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <button
                type="button"
                data-toc-index={i}
                onClick={() => scrollToDomId(h.domId!)}
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
                      width={24}
                      height={24}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      style={{
                        width: 24,
                        height: 24,
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
