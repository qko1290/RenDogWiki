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
  /** 문서 뷰의 스크롤 컨테이너 선택자(예: '#wiki-scroll-root') */
  scrollRootSelector?: string;
};

export default function TableOfContents({
  headings,
  headerOffset = 72,
  right = 20,
  top = 100,
  width = 240,
  title = '목차',
  scrollRootSelector,
}: Props) {
  const [activeId, setActiveId] = useState<string>('');
  const rootRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [rootKey, setRootKey] = useState(0); // 루트 변경 트리거 키

  // 동일 id에 발생 순번 부여
  const indexed = useMemo(() => {
    const seen: Record<string, number> = {};
    return headings.map(h => {
      const occ = seen[h.id] ?? 0;
      seen[h.id] = occ + 1;
      return { ...h, __occ: occ } as Heading & { __occ: number };
    });
  }, [headings]);

  // 스크롤 가능한 조상 자동 탐색
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

  // root 결정(명시 selector > 자동 > null), 변경 시 rootKey 갱신
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
        rootRef.current.scrollHeight > rootRef.current.clientHeight + 1;
      if (canScroll) return rootRef.current;
    }

    // 2순위: 타겟 기준으로 스크롤 가능한 조상 자동 탐색
    return findScrollableAncestor(target);
  };

  // 컨테이너 기준 스무스 스크롤
  const scrollToId = (
    id: string,
    occ: number,
    behavior: ScrollBehavior = 'smooth'
  ) => {
    const target = getTarget(id, occ);
    if (!target) return;

    const root = getScrollRoot(target);

    if (!root) {
      // window 스크롤
      const y = target.getBoundingClientRect().top + window.scrollY - headerOffset;
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
        new CustomEvent('editor:toc-jump', { detail: { id, occ } })
      );
    } catch {
      // ignore
    }
  };

  // 스크롤 스파이(컨테이너 기준)
  useEffect(() => {
    if (!indexed.length) return;

    observerRef.current?.disconnect();
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) =>
            a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1
          );
        if (visible[0]) {
          setActiveId((visible[0].target as HTMLElement).id);
        }
      },
      {
        root: getRootForObserver(),
        rootMargin: `-${headerOffset + 8}px 0px -70% 0px`,
        threshold: [0, 1],
      }
    );
    observerRef.current = obs;

    // 동일 id 전부 observe
    const observed: HTMLElement[] = [];
    const seenIds = new Set<string>();
    indexed.forEach(({ id }) => {
      if (seenIds.has(id)) return;
      seenIds.add(id);
      const esc = id.replace(/"/g, '\\"');
      document.querySelectorAll<HTMLElement>(`[id="${esc}"]`).forEach(el => {
        obs.observe(el);
        observed.push(el);
      });
    });

    return () => {
      observed.forEach(el => obs.unobserve(el));
      obs.disconnect();
    };
  }, [indexed, headerOffset, rootKey]);

  // 새 문서 로드 후 URL 해시가 있으면 해당 위치로 한 번 스크롤
  useEffect(() => {
    if (!headings.length) return;

    const rawHash = window.location.hash || '';
    if (!rawHash) return;

    const hash = decodeURIComponent(rawHash).replace(/^#/, '');
    if (!hash) return;

    const raf = requestAnimationFrame(() => {
      // ✅ 초기 진입 시에는 애니메이션 없이 바로 점프
      //    (맨 위에서부터 길게 스크롤되는 느낌 방지)
      scrollToId(hash, 0, 'auto');
    });
    return () => cancelAnimationFrame(raf);
  }, [headings, rootKey]);

  // ----- UI -----
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
    letterSpacing: '-0.15px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  if (!indexed.length) {
    return (
      <aside
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

  return (
    <aside
      role="navigation"
      aria-label="Table of contents"
      style={boxStyle}
    >
      <p style={titleStyle}>
        <FontAwesomeIcon icon={faAlignLeft} />
        &nbsp;&nbsp;{title}
      </p>
      <ul style={listStyle}>
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
