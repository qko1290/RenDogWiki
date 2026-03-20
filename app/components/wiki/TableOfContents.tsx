// =============================================
// File: app/components/wiki/TableOfContents.tsx
// - 해시 포함 링크로 진입했을 때 스크롤 재시도 로직 유지
// - 사이드바(목차 영역)에서는 링크 복사 버튼 제거
// - 문서 제목/아이콘(docTitle/docIcon) 목차 맨 위에 표시
// - 활성 목차 슬라이딩 하이라이트 + TOC 자동 스크롤
// - 목차 클릭 직후 대상 heading DOM이 아직 준비되지 않은 경우 짧게 재시도
// - 목차 클릭으로 smooth scroll 중일 때 스크롤 기반 active 재계산 잠금
//   → 강조 표시가 원래 위치로 잠깐 튀는 현상 방지
// - 긴 문서/늦게 커지는 레이아웃에서도 목표 heading까지 끝까지 도달하도록
//   초기 스크롤 이후 여러 번 위치를 재측정해서 보정
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

  // 클릭 재시도 타이머 관리
  const retryTimeoutsRef = useRef<number[]>([]);

  // 긴 문서/레이아웃 지연용 스크롤 보정 타이머 관리
  const stableScrollTimeoutsRef = useRef<number[]>([]);

  // 프로그램적 스크롤(목차 클릭 이동) 잠금
  const isProgrammaticScrollingRef = useRef(false);
  const programmaticTargetDomIdRef = useRef<string | null>(null);
  const programmaticUnlockTimerRef = useRef<number | null>(null);

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

  const [activeDomId, setActiveDomId] = useState('');

  // ✅ DOM target 찾기: domId로 단일 조회
  const getTargetByDomId = (domId: string) => {
    return document.getElementById(domId);
  };

  const clearRetryTimeouts = () => {
    for (const id of retryTimeoutsRef.current) {
      window.clearTimeout(id);
    }
    retryTimeoutsRef.current = [];
  };

  const clearStableScrollTimeouts = () => {
    for (const id of stableScrollTimeoutsRef.current) {
      window.clearTimeout(id);
    }
    stableScrollTimeoutsRef.current = [];
  };

  const clearProgrammaticUnlockTimer = () => {
    if (programmaticUnlockTimerRef.current != null) {
      window.clearTimeout(programmaticUnlockTimerRef.current);
      programmaticUnlockTimerRef.current = null;
    }
  };

  const releaseProgrammaticScrollLock = () => {
    isProgrammaticScrollingRef.current = false;
    programmaticTargetDomIdRef.current = null;
    clearProgrammaticUnlockTimer();
  };

  const startProgrammaticScrollLock = (targetDomId: string) => {
    isProgrammaticScrollingRef.current = true;
    programmaticTargetDomIdRef.current = targetDomId;
    clearProgrammaticUnlockTimer();

    // smooth scroll + 보정 스크롤 중 영구 잠금되지 않도록 fallback 해제
    programmaticUnlockTimerRef.current = window.setTimeout(() => {
      releaseProgrammaticScrollLock();
    }, 2600);
  };

  const pickClosestDomId = (): { domId: string; index: number } | null => {
    if (!indexed.length) return null;

    const root = getScrollRootEl();
    const baseScrollTop = root ? root.scrollTop : window.scrollY;
    const baseLine = baseScrollTop + headerOffset + 8;

    const items = indexed
      .map((h, i) => {
        const el = document.getElementById(h.domId!);
        if (!el) return null;

        const y = getYInScrollRoot(el, root);
        return { domId: h.domId!, index: i, delta: y - baseLine };
      })
      .filter(Boolean) as { domId: string; index: number; delta: number }[];

    if (!items.length) return null;

    let bestAbove: (typeof items)[number] | null = null;
    for (const it of items) {
      if (it.delta <= 0) {
        if (!bestAbove || it.delta > bestAbove.delta) bestAbove = it;
      }
    }
    if (bestAbove) return { domId: bestAbove.domId, index: bestAbove.index };

    let bestBelow = items[0];
    for (const it of items) {
      if (it.delta < bestBelow.delta) bestBelow = it;
    }
    return { domId: bestBelow.domId, index: bestBelow.index };
  };

  // ✅ intersect가 없어도(로드 직후/최상단) "가장 가까운 heading"을 강제로 계산해서 active 세팅
  const setActiveByClosest = () => {
    if (!indexed.length) return false;

    const root = getScrollRootEl();
    const rootRectTop = root ? root.getBoundingClientRect().top : 0;
    const headerLine = rootRectTop + headerOffset + 8;

    let bestDomId = '';
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
      setActiveId(bestDomId);
      if (bestIndex !== -1) setActiveIndex(bestIndex);
      return true;
    }

    return false;
  };

  const hasDocTitle = !!(docTitle && docTitle.trim());
  const docTitleAnchor = indexed[0] ?? null;
  const resolvedDocIcon = docIcon ?? docTitleAnchor?.icon ?? undefined;

  useEffect(() => {
    return () => {
      clearRetryTimeouts();
      clearStableScrollTimeouts();
      releaseProgrammaticScrollLock();
      observerRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    clearRetryTimeouts();
    clearStableScrollTimeouts();
    releaseProgrammaticScrollLock();
  }, [indexed]);

  useEffect(() => {
    if (!headings || headings.length === 0) {
      setActiveId('');
      setActiveDomId('');
      setActiveIndex(-1);

      prevTopRef.current = null;
      setIndicatorTop(0);
      setIndicatorHeight(0);
      setIndicatorDuration('140ms');

      observerRef.current?.disconnect();
      clearRetryTimeouts();
      clearStableScrollTimeouts();
      releaseProgrammaticScrollLock();
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
    return rootRef.current;
  };

  const getScrollRoot = (target: HTMLElement | null): HTMLElement | null => {
    if (!target) return rootRef.current;

    if (rootRef.current) {
      const { overflowY } = getComputedStyle(rootRef.current);
      const canScroll =
        /(auto|scroll)/.test(overflowY) &&
        rootRef.current.scrollHeight > rootRef.current.clientHeight + 1;
      if (canScroll) return rootRef.current;
    }

    return findScrollableAncestor(target);
  };

  function resolveRootEl(): HTMLElement | null {
    if (scrollRootSelector) {
      const el = document.querySelector(scrollRootSelector) as HTMLElement | null;
      if (el) return el;
    }

    if (indexed.length) {
      const first = document.getElementById(indexed[0].domId!);
      if (first) return findScrollableAncestor(first);
    }
    return null;
  }

  const getScrollMetricsForDomId = (domId: string, forcedRoot?: HTMLElement | null) => {
    const target = getTargetByDomId(domId);
    if (!target) return null;

    const root = forcedRoot !== undefined ? forcedRoot : getScrollRoot(target);

    if (!root) {
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      return { target, root: null as HTMLElement | null, top };
    }

    const rootRect = root.getBoundingClientRect();
    const top =
      target.getBoundingClientRect().top - rootRect.top + root.scrollTop - headerOffset;

    return { target, root, top };
  };

  const applyScrollTop = (
    root: HTMLElement | null,
    topValue: number,
    behavior: ScrollBehavior = 'smooth',
  ) => {
    const nextTop = Math.max(0, topValue);

    if (!root) {
      window.scrollTo({ top: nextTop, behavior });
      return;
    }

    root.scrollTo({ top: nextTop, behavior });
  };

  const scheduleStableScrollCorrection = (
    domId: string,
    root: HTMLElement | null,
    initialBehavior: ScrollBehavior,
  ) => {
    clearStableScrollTimeouts();

    const correctionDelays =
      initialBehavior === 'auto'
        ? [80, 180, 320, 520, 760, 1080, 1480, 2000]
        : [140, 260, 420, 620, 860, 1180, 1580, 2100];

    for (const delay of correctionDelays) {
      const timerId = window.setTimeout(() => {
        const metrics = getScrollMetricsForDomId(domId, root ?? resolveRootEl());
        if (!metrics) return;

        const currentTop = metrics.root ? metrics.root.scrollTop : window.scrollY;
        const delta = metrics.top - currentTop;

        if (Math.abs(delta) > 2) {
          applyScrollTop(metrics.root, metrics.top, 'auto');
        }
      }, delay);

      stableScrollTimeoutsRef.current.push(timerId);
    }
  };

  const scrollToDomId = (
    domId: string,
    behavior: ScrollBehavior = 'smooth',
    options?: {
      stable?: boolean;
      updateHash?: boolean;
      lockProgrammatic?: boolean;
    },
  ): boolean => {
    const stable = options?.stable ?? true;
    const updateHash = options?.updateHash ?? true;
    const lockProgrammatic = options?.lockProgrammatic ?? (behavior === 'smooth');

    const metrics = getScrollMetricsForDomId(domId);
    if (!metrics) return false;

    applyScrollTop(metrics.root, metrics.top, behavior);

    if (stable) {
      scheduleStableScrollCorrection(domId, metrics.root, behavior);
    }

    if (updateHash) {
      try {
        const st = window.history.state;
        const url = new URL(window.location.href);
        url.hash = `#${domId}`;
        window.history.replaceState(st, '', url.toString());
      } catch {}
    }

    const idx = indexed.findIndex((h) => h.domId === domId);
    setActiveDomId(domId);
    setActiveId(domId);
    if (idx !== -1) setActiveIndex(idx);

    if (lockProgrammatic) {
      startProgrammaticScrollLock(domId);
    }

    return true;
  };

  const scrollToDomIdWithRetry = (domId: string, behavior: ScrollBehavior = 'smooth') => {
    clearRetryTimeouts();

    const tryScroll = (candidate: string) => {
      const latestRoot = resolveRootEl();
      if (latestRoot !== rootRef.current) {
        rootRef.current = latestRoot;
      }

      const ok = scrollToDomId(candidate, behavior, {
        stable: true,
        updateHash: true,
        lockProgrammatic: behavior === 'smooth',
      });
      if (ok) {
        return true;
      }

      if (!candidate.includes('--')) {
        const fallback = `${candidate}--0`;
        const fallbackOk = scrollToDomId(fallback, behavior, {
          stable: true,
          updateHash: true,
          lockProgrammatic: behavior === 'smooth',
        });
        if (fallbackOk) {
          return true;
        }
      }

      return false;
    };

    if (tryScroll(domId)) return;

    const delays = [80, 180, 320];

    for (const delay of delays) {
      const timerId = window.setTimeout(() => {
        if (tryScroll(domId)) {
          clearRetryTimeouts();
          return;
        }

        if (delay === delays[delays.length - 1]) {
          setActiveByClosest();
        }
      }, delay);

      retryTimeoutsRef.current.push(timerId);
    }
  };

  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const maxTries = 60;

    const resolve = () => {
      tries += 1;

      if (scrollRootSelector) {
        const sel = document.querySelector(scrollRootSelector) as HTMLElement | null;
        if (sel) {
          rootRef.current = sel;
          setRootKey((k) => k + 1);
          return;
        }
        if (tries < maxTries) raf = requestAnimationFrame(resolve);
        return;
      }

      if (indexed.length) {
        const firstDomId = indexed[0].domId!;
        const first = document.getElementById(firstDomId);

        if (first) {
          rootRef.current = findScrollableAncestor(first) || null;
          setRootKey((k) => k + 1);
          return;
        }

        if (tries < maxTries) raf = requestAnimationFrame(resolve);
        return;
      }

      rootRef.current = null;
      setRootKey((k) => k + 1);
    };

    raf = requestAnimationFrame(resolve);

    return () => cancelAnimationFrame(raf);
  }, [scrollRootSelector, indexed]);

  useEffect(() => {
    if (!indexed.length) return;

    let raf = 0;

    const apply = () => {
      const root = resolveRootEl();
      if (root !== rootRef.current) {
        rootRef.current = root;
      }

      // ✅ 목차 클릭으로 이동 중이면, 스크롤 기반 active 계산이
      // 클릭 target을 잠깐 이전 위치로 되돌리지 못하게 막는다.
      if (isProgrammaticScrollingRef.current) {
        const targetDomId = programmaticTargetDomIdRef.current;

        if (targetDomId) {
          const targetEl = document.getElementById(targetDomId);

          if (targetEl) {
            const rootRectTop = root ? root.getBoundingClientRect().top : 0;
            const headerLine = rootRectTop + headerOffset + 8;
            const targetTop = targetEl.getBoundingClientRect().top;
            const distance = Math.abs(targetTop - headerLine);

            const targetIndex = indexed.findIndex((h) => h.domId === targetDomId);

            // 이동 중에는 target active 유지
            if (activeDomId !== targetDomId) {
              setActiveDomId(targetDomId);
              setActiveId(targetDomId);
            }
            if (targetIndex !== -1 && activeIndex !== targetIndex) {
              setActiveIndex(targetIndex);
            }

            // target이 header line 근처에 도달하면 잠금 해제
            if (distance <= 28) {
              releaseProgrammaticScrollLock();
            }

            return;
          }

          // target DOM을 못 찾으면 잠금 해제하고 일반 계산으로 복귀
          releaseProgrammaticScrollLock();
        } else {
          releaseProgrammaticScrollLock();
        }
      }

      const baseScrollTop = root ? root.scrollTop : window.scrollY;

      const ACTIVE_BIAS_PX = 80;
      const effectiveOffset = (root ? 0 : headerOffset) + ACTIVE_BIAS_PX;
      const baseLine = baseScrollTop + effectiveOffset + 8;

      let bestDomId = '';
      let bestIndex = -1;
      let bestAboveDelta = -Infinity;
      let bestBelowDelta = Infinity;

      for (let i = 0; i < indexed.length; i++) {
        const domId = indexed[i].domId!;
        const el = document.getElementById(domId);
        if (!el) continue;

        const y = getYInScrollRoot(el, root);
        const delta = y - baseLine;

        if (delta <= 0) {
          if (delta > bestAboveDelta) {
            bestAboveDelta = delta;
            bestDomId = domId;
            bestIndex = i;
          }
        } else {
          if (bestDomId === '' && delta < bestBelowDelta) {
            bestBelowDelta = delta;
            bestDomId = domId;
            bestIndex = i;
          }
        }
      }

      if (bestDomId) {
        setActiveDomId(bestDomId);
        setActiveId(bestDomId);
        setActiveIndex(bestIndex);
      }
    };

    const onAnyScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    document.addEventListener('scroll', onAnyScroll, { passive: true, capture: true });
    window.addEventListener('wheel', onAnyScroll, { passive: true });
    window.addEventListener('touchmove', onAnyScroll, { passive: true });

    const r1 = requestAnimationFrame(() => requestAnimationFrame(apply));

    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(raf);
      document.removeEventListener('scroll', onAnyScroll, true);
      window.removeEventListener('wheel', onAnyScroll);
      window.removeEventListener('touchmove', onAnyScroll);
    };
  }, [indexed, headerOffset, scrollRootSelector, activeDomId, activeIndex]);

  useEffect(() => {
    if (!indexed.length) return;

    const rawHash = window.location.hash || '';
    if (!rawHash) return;

    const hash = decodeURIComponent(rawHash).replace(/^#/, '');
    if (!hash) return;

    const tryScroll = (h: string) => {
      const ok = scrollToDomId(h, 'auto', {
        stable: true,
        updateHash: false,
        lockProgrammatic: false,
      });
      if (ok) {
        setActiveDomId(h);
        setActiveId(h);
        const idx = indexed.findIndex((x) => x.domId === h);
        if (idx !== -1) setActiveIndex(idx);
      }
      return ok;
    };

    const raf = requestAnimationFrame(() => {
      if (tryScroll(hash)) return;

      if (!hash.includes('--') && tryScroll(`${hash}--0`)) return;

      setTimeout(() => {
        if (tryScroll(hash)) return;
        if (!hash.includes('--') && tryScroll(`${hash}--0`)) return;
        setTimeout(() => {
          tryScroll(hash);
          if (!hash.includes('--')) tryScroll(`${hash}--0`);
        }, 180);
      }, 120);
    });

    return () => cancelAnimationFrame(raf);
  }, [indexed, rootKey]);

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

    const elementTop = itemRect.top - containerRect.top + container.scrollTop;
    const elementBottom = itemRect.bottom - containerRect.top + container.scrollTop;

    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const padding = 24;

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
  }, [activeIndex]);

  function getYInScrollRoot(el: HTMLElement, root: HTMLElement | null) {
    if (!root) {
      return el.getBoundingClientRect().top + window.scrollY;
    }

    const rootRect = root.getBoundingClientRect();
    return el.getBoundingClientRect().top - rootRect.top + root.scrollTop;
  }

  const boxStyle: React.CSSProperties = {
    position: 'fixed',
    right,
    top,
    width,
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: 'var(--shadow-lg)',
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
    color: 'var(--foreground)',
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
    color: 'var(--foreground)',
  };

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
              color: 'var(--foreground)',
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
            color: 'var(--muted-2)',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            padding: '14px 8px',
            borderRadius: 10,
            background: 'var(--surface-soft)',
            border: '1px dashed var(--border)',
          }}
        >
          목차 없음
        </div>
      </aside>
    );
  }

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

      <ul style={listStyle}>
        {hasDocTitle && (
          <li key="__doc-title" style={{ marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => {
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
                color: 'var(--foreground)',
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
              background: 'var(--accent-soft)',
              borderLeft: '3px solid var(--accent)',
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
                onClick={() => scrollToDomIdWithRetry(h.domId!)}
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
                  color: active ? 'var(--accent)' : 'var(--muted)',
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