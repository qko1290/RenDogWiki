// File: C:\next\rdwiki\app\components\wiki\TableOfContents.tsx
'use client';

/**
 * 문서 내 목차(Table of Contents)
 * - headings(id/text/icon/level)을 받아 스크롤 스파이 + 점프 스크롤 제공
 * - 스크롤 컨테이너를 지정하지 않으면 첫 헤딩 기준으로 스크롤 가능한 조상을 자동 탐색
 * - 활성 항목 하이라이트, 아이콘(이모지/이미지) 표시
 * - 접근성: role="navigation", aria-current, reduced motion 대응
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAlignLeft } from '@fortawesome/free-solid-svg-icons';

type Heading = { id: string; text: string; icon?: string; level: 1 | 2 | 3 };

export default function TableOfContents({
  headings,
  headerOffset = 72,
  title = '목차',
  scrollRootSelector,
  zIndex = 1,
}: {
  headings: Heading[];
  headerOffset?: number;
  title?: string;
  /** 문서 뷰의 스크롤 컨테이너 선택자(예: '#wiki-scroll') */
  scrollRootSelector?: string;
  zIndex?: number;
}) {
  const [activeId, setActiveId] = useState<string>('');
  const rootRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 동일 id에 발생 순번 부여(키/타겟 식별용)
  const indexed = useMemo(() => {
    const seen: Record<string, number> = {};
    return headings.map(h => {
      const occ = seen[h.id] ?? 0;
      seen[h.id] = occ + 1;
      return { ...h, __occ: occ };
    });
  }, [headings]);

  // 유틸: 스크롤 가능한 조상 찾기
  const findScrollableAncestor = (el: HTMLElement | null) => {
    let cur: HTMLElement | null = el?.parentElement ?? null;
    while (cur) {
      const { overflowY } = getComputedStyle(cur);
      const canScroll = /(auto|scroll)/.test(overflowY) && cur.scrollHeight > cur.clientHeight + 1;
      if (canScroll) return cur;
      cur = cur.parentElement;
    }
    return null;
  };

  // 유틸: id 쿼리용 escape
  const escId = (id: string) => id.replace(/"/g, '\\"');

  // 스크롤 루트 결정(명시 selector > 자동 탐색 > null(window))
  useEffect(() => {
    if (scrollRootSelector) {
      rootRef.current = document.querySelector<HTMLElement>(scrollRootSelector);
      return;
    }
    const firstId = headings[0]?.id ?? '';
    const first = document.querySelector<HTMLElement>(`[id="${escId(firstId)}"]`);
    rootRef.current = findScrollableAncestor(first) || null;
  }, [scrollRootSelector, headings]);

  // 타겟 찾기(동일 id의 n번째 요소)
  const getTarget = (id: string, occ: number) => {
    const list = document.querySelectorAll<HTMLElement>(`[id="${escId(id)}"]`);
    return list[occ] ?? list[0] ?? null;
  };

  // 사용자 모션 선호도(감속 설정 시 smooth 비활성화)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 컨테이너 기준 스무스 스크롤
  const scrollToId = (id: string, occ: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    const target = getTarget(id, occ);
    if (!target) return;

    const root = rootRef.current;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    if (!root) {
      const y = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: y, behavior });
    } else {
      const y =
        target.getBoundingClientRect().top -
        root.getBoundingClientRect().top +
        root.scrollTop -
        headerOffset;
      root.scrollTo({ top: y, behavior });
    }
    try {
      history.replaceState(null, '', `#${id}`);
    } catch {
      /* no-op */
    }
  };

  // 스크롤 스파이(IntersectionObserver)
  useEffect(() => {
    if (!indexed.length) return;

    // 이전 옵저버 정리
    observerRef.current?.disconnect();

    const root = rootRef.current ?? null;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1));
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
      },
      {
        root,
        rootMargin: `-${headerOffset + 8}px 0px -70% 0px`,
        threshold: [0, 1],
      }
    );
    observerRef.current = obs;

    // 동일 id의 모든 요소 observe
    indexed.forEach(({ id }) => {
      document
        .querySelectorAll<HTMLElement>(`[id="${escId(id)}"]`)
        .forEach(el => obs.observe(el));
    });

    return () => obs.disconnect();
    // headings, scrollRootSelector, headerOffset이 변할 때 재설정
  }, [indexed, headerOffset, scrollRootSelector]);

  // ----- UI (스티키 박스) -----
  const boxStyle: React.CSSProperties = {
    position: 'sticky',
    background: 'transparent',
    border: '0',
    borderRadius: 0,
    boxShadow: 'none', 
    padding: 0, 
    maxHeight: `calc(100vh - ${headerOffset + 24}px)`,
    overflow: 'auto',
    zIndex,
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
    margin: '0 0 8px 2px', 
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
      <aside style={{ ...boxStyle, display: 'grid', placeItems: 'center', color: '#9aa1ad' }}>
        목차 없음
      </aside>
    );
  }

  return (
     <aside style={boxStyle} aria-label="Table of contents" role="navigation">
      <p style={titleStyle}>
        <FontAwesomeIcon icon={faAlignLeft} />
        &nbsp;&nbsp; {title}
      </p>

      {indexed.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9aa1ad', padding: '4px 2px' }}>
          목차 없음
        </div>
      ) : (
        <ul style={listStyle}>
          {indexed.map((h, i) => {
            const active = h.id === activeId;
            const padLeft = h.level === 1 ? 8 : h.level === 2 ? 26 : 44;
            return (
              <li key={`${h.id}-${h.__occ}-${i}`}>
                <a
                  href={`#${h.id}`}
                  onClick={(e) => scrollToId(h.id, h.__occ, e)}
                  title={h.text}
                  aria-current={active ? 'true' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    minHeight: 28,
                    color: active ? '#2563eb' : '#4b5563',
                    background: active ? '#eff6ff' : 'transparent',
                    borderLeft: `3px solid ${active ? '#2563eb' : 'transparent'}`,
                    padding: '6px 8px',
                    paddingLeft: padLeft,
                    borderRadius: 8,
                    transition: 'background .12s, color .12s, border-color .12s',
                  }}
                >
                  {/* (아이콘 렌더링 부분 그대로 유지) */}
                  <span style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', flex: '0 0 auto', marginRight: 8 }} aria-hidden>
                    {h.icon?.startsWith('http') ? (
                      <img src={h.icon} alt="" style={{ width: 16, height: 16, objectFit: 'contain', display: 'block' }} />
                    ) : h.icon ? (
                      <span style={{ fontSize: 14, lineHeight: 1, display: 'block' }}>{h.icon}</span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.text}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
