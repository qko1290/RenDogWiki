'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Heading = {
  text: string;
  id: string;
  level: 1 | 2 | 3;
  icon?: string;
};

type Props = {
  headings: Heading[];
  headerOffset?: number;           // 고정 헤더 높이 보정
  right?: number;
  top?: number;
  width?: number;
  title?: string;
  scrollRootSelector?: string;     // 스크롤 컨테이너를 명시하고 싶을 때
};

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAlignLeft
} from '@fortawesome/free-solid-svg-icons';

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

  // 동일 id에 발생 순번 부여(키/타겟 식별)
  const indexed = useMemo(() => {
    const seen: Record<string, number> = {};
    return headings.map(h => {
      const occ = seen[h.id] ?? 0;
      seen[h.id] = occ + 1;
      return { ...h, __occ: occ };
    });
  }, [headings]);

  // 스크롤 가능한 조상 자동 탐색
  const findScrollableAncestor = (el: HTMLElement | null): HTMLElement | null => {
    let cur: HTMLElement | null = el?.parentElement ?? null;
    while (cur) {
      const { overflowY } = getComputedStyle(cur);
      const canScroll = /(auto|scroll)/.test(overflowY) && cur.scrollHeight > cur.clientHeight + 1;
      if (canScroll) return cur;
      cur = cur.parentElement;
    }
    return null;
  };

  // root 결정(명시 selector > 자동 > null(window))
  useEffect(() => {
    if (scrollRootSelector) {
      rootRef.current = document.querySelector<HTMLElement>(scrollRootSelector);
      return;
    }
    // 첫 헤딩 기준 자동
    const first = document.querySelector<HTMLElement>(`[id="${(headings[0]?.id ?? '').replace(/"/g, '\\"')}"]`);
    rootRef.current = findScrollableAncestor(first) || null;
  }, [scrollRootSelector, headings]);

  const getRootForObserver = () => rootRef.current ?? null;

  // 타겟 찾기(동일 id의 n번째)
  const getTarget = (id: string, occ: number) => {
    const esc = id.replace(/"/g, '\\"');
    const list = document.querySelectorAll<HTMLElement>(`[id="${esc}"]`);
    return list[occ] ?? list[0] ?? null;
  };

  // 컨테이너 기준 스무스 스크롤
  const scrollToId = (id: string, occ: number) => {
    const target = getTarget(id, occ);
    if (!target) return;

    const root = rootRef.current;
    if (!root) {
      const y = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      const y =
        target.getBoundingClientRect().top -
        root.getBoundingClientRect().top +
        root.scrollTop -
        headerOffset;
      root.scrollTo({ top: y, behavior: 'smooth' });
    }
    try { history.replaceState(null, '', `#${id}`); } catch {}
  };

  // 스크롤 스파이(컨테이너 기준)
  useEffect(() => {
    if (!indexed.length) return;

    observerRef.current?.disconnect();
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1));
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
      },
      {
        root: getRootForObserver(),
        rootMargin: `-${headerOffset + 8}px 0px -70% 0px`,
        threshold: [0, 1],
      }
    );
    observerRef.current = obs;

    // 동일 id 전부 observe
    const seen: Record<string, number> = {};
    indexed.forEach(({ id }) => {
      const esc = id.replace(/"/g, '\\"');
      document.querySelectorAll<HTMLElement>(`[id="${esc}"]`).forEach(el => obs.observe(el));
      seen[id] = (seen[id] ?? 0) + 1;
    });

    // 컨테이너 변경 시 다시 연결
    const root = getRootForObserver();
    const cleanupScroll = () => {};
    return () => {
      cleanupScroll();
      obs.disconnect();
    };
  }, [indexed, headerOffset, rootRef.current]);

  // ----- UI (같음, 위치만 고정) -----
  const boxStyle: React.CSSProperties = {
    position: 'fixed', right: right, top: top, width,
    background: '#fff',
    border: '1px solid #eef1f5',
    borderRadius: 12,
    boxShadow: '0 2px 14px rgba(0,0,0,.05)',
    padding: '12px 10px',
    zIndex: 50,
  };
  const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 };
  const iconBox: React.CSSProperties = { width: 18, height: 18, display: 'grid', placeItems: 'center', flex: '0 0 auto', marginRight: 8 };
  const titleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 10px 8px' };
  const textStyle: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  if (!indexed.length) return <aside style={{ ...boxStyle, display: 'grid', placeItems: 'center', color: '#9aa1ad' }}>목차 없음</aside>;

  return (
    <aside style={boxStyle} aria-label="Table of contents">
      <p style={titleStyle}><FontAwesomeIcon icon={faAlignLeft} />&nbsp;&nbsp;{title}</p>
      <ul style={listStyle}>
        {indexed.map((h, i) => {
          const active = h.id === activeId;
          const padLeft = h.level === 1 ? 8 : h.level === 2 ? 26 : 44;
          return (
            <li key={`${h.id}-${h.__occ}-${i}`}>
              <button
                onClick={() => scrollToId(h.id, h.__occ)}
                title={h.text}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  cursor: 'pointer', border: 0, background: active ? '#eff6ff' : 'transparent',
                  borderLeft: `3px solid ${active ? '#2563eb' : 'transparent'}`,
                  color: active ? '#2563eb' : '#4b5563',
                  padding: '6px 8px', paddingLeft: padLeft, borderRadius: 8,
                  textAlign: 'left', transition: 'background .12s, color .12s, border-color .12s',
                }}
              >
                <span style={iconBox} aria-hidden>
                  {h.icon?.startsWith('http') ? (
                    <img src={h.icon} alt="" style={{ width: 16, height: 16, objectFit: 'contain', display: 'block' }} />
                  ) : h.icon ? (
                    <span style={{ fontSize: 14, lineHeight: 1, display: 'block' }}>{h.icon}</span>
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
