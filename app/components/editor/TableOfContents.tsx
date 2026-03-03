// =============================================
// File: app/components/editor/TableOfContents.tsx
// (에디터 TOC: heading domId(heading-xxx--N) 기준으로 스크롤/active/해시 동작)
// =============================================
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type HeadingItem = {
  id: string;      // baseId: "heading-xxx"
  text: string;
  level: number;
};

type Props = {
  headings: HeadingItem[];
  /** heading들이 들어있는 스크롤 컨테이너 (없으면 document 사용) */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** hash 갱신 on/off (원하면 끌 수 있게) */
  syncHash?: boolean;
  /** 스크롤 보정(px) */
  offsetTop?: number;
};

type IndexedHeading = HeadingItem & {
  occ: number;
  domId: string; // "heading-xxx--0"
};

function normalizeHashId(raw: string) {
  const s = String(raw || "").replace(/^#/, "");
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default function TableOfContents({
  headings,
  containerRef,
  syncHash = true,
  offsetTop = 0,
}: Props) {
  const [activeId, setActiveId] = useState<string>("");

  // ✅ baseId 중복을 고려해서 domId(heading-xxx--N) 목록 생성
  const indexed = useMemo<IndexedHeading[]>(() => {
    const map = new Map<string, number>();
    return headings.map((h) => {
      const base = h.id;
      const occ = map.get(base) ?? 0;
      map.set(base, occ + 1);
      return {
        ...h,
        occ,
        domId: `${base}--${occ}`,
      };
    });
  }, [headings]);

  const getScrollRoot = () => containerRef?.current ?? null;

  const getTargetEl = (domId: string) => {
    // containerRef가 있으면 그 안에서 찾고, 없으면 document에서 찾기
    const root = getScrollRoot();
    if (root) return root.querySelector<HTMLElement>(`#${CSS.escape(domId)}`);
    return document.getElementById(domId) as HTMLElement | null;
  };

  const scrollToDomId = (domId: string) => {
    const el = getTargetEl(domId);
    if (!el) return;

    const root = getScrollRoot();

    // container 스크롤을 쓰는 경우 / window 스크롤을 쓰는 경우 둘 다 지원
    if (root) {
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const top = (elRect.top - rootRect.top) + root.scrollTop - offsetTop;
      root.scrollTo({ top, behavior: "smooth" });
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - offsetTop;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // ✅ 최초 진입 시 hash가 있으면 그 domId로 스크롤/active 맞추기
  useEffect(() => {
    const hid = normalizeHashId(window.location.hash);
    if (!hid) return;

    // hash가 baseId만 들어오는 경우도 안전하게 처리:
    // - heading-xxx → heading-xxx--0 로 폴백
    const domId =
      hid.includes("--") ? hid : `${hid}--0`;

    // 다음 tick에서 스크롤(레이아웃 안정)
    const t = window.setTimeout(() => {
      scrollToDomId(domId);
      setActiveId(domId);
    }, 0);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ IntersectionObserver로 activeId를 “domId”로 갱신
  useEffect(() => {
    if (!indexed.length) return;

    const root = getScrollRoot();

    const targets = indexed
      .map((h) => getTargetEl(h.domId))
      .filter(Boolean) as HTMLElement[];

    if (!targets.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        // 화면에 들어온 heading 중 가장 위쪽을 active로
        const visible = entries
          .filter((e) => e.isIntersecting && e.target instanceof HTMLElement)
          .map((e) => e.target as HTMLElement);

        if (!visible.length) return;

        visible.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const id = visible[0]?.id || "";
        if (id) setActiveId(id);
      },
      {
        root: root ?? null,
        // 상단 고정 헤더/오프셋 고려
        rootMargin: `-${Math.max(0, offsetTop)}px 0px -70% 0px`,
        threshold: [0, 0.1, 0.2, 0.3],
      }
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [indexed, containerRef, offsetTop]);

  const handleClick = (h: IndexedHeading) => {
    scrollToDomId(h.domId);
    setActiveId(h.domId);

    if (syncHash) {
      // ✅ 해시도 domId로 통일
      try {
        history.replaceState(null, "", `#${encodeURIComponent(h.domId)}`);
      } catch {
        // noop
      }
    }
  };

  if (!indexed.length) return null;

  return (
    <div className="wiki-toc">
      {indexed.map((h) => {
        const isActive = h.domId === activeId;

        return (
          <button
            key={h.domId}
            type="button"
            onClick={() => handleClick(h)}
            className={"wiki-toc-item" + (isActive ? " is-active" : "")}
            style={{
              textAlign: "left",
              width: "100%",
              background: "transparent",
              border: "none",
              padding: "6px 8px",
              cursor: "pointer",
              fontWeight: isActive ? 800 : 600,
              opacity: isActive ? 1 : 0.85,
              marginLeft: (h.level - 1) * 10,
            }}
            title={h.text}
          >
            {h.text}
          </button>
        );
      })}
    </div>
  );
}