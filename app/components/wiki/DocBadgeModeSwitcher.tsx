// =============================================
// File: app/components/wiki/DocBadgeModeSwitcher.tsx
// 전체 코드
// - 바로가기 배지 영역을 감지해 전환 버튼을 위쪽 말풍선으로 표시
// - 말풍선과 배지 사이 이동 구간을 연결해 조작감 개선
// - 기존 바로가기 배지의 transition 시간을 읽어 표시/숨김 속도 동기화
// - 기존 localStorage 및 전환 이벤트 유지
// =============================================

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  createPortal,
} from 'react-dom';

import styles from '@/wiki/css/docBadgeModeSwitcher.module.css';

type DocBadgeMode =
  | 'quick'
  | 'favorites';

type SwitcherPosition = {
  left: number;
  top: number;
};

type BadgeContext = {
  anchor: HTMLElement;
  root: HTMLElement;
};

const BADGE_MODE_STORAGE =
  'wiki:doc-badge-mode';

const BADGE_MODE_EVENT =
  'wiki-doc-badge-mode-change';

const DEFAULT_TRANSITION_MS = 180;

const QUICK_BADGE_WORDS = [
  '바로가기',
  '즐겨찾기',
  '퀘스트',
  '상점',
  '도감',
  '계산기',
] as const;

const INTERACTIVE_SELECTOR =
  'button, a, [role="button"]';

function readBadgeMode(): DocBadgeMode {
  if (typeof window === 'undefined') {
    return 'quick';
  }

  return window.localStorage.getItem(
    BADGE_MODE_STORAGE,
  ) === 'favorites'
    ? 'favorites'
    : 'quick';
}

function getElementLabel(
  element: HTMLElement,
) {
  return [
    element.textContent,
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('data-tooltip'),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isVisible(
  element: HTMLElement,
) {
  const rect =
    element.getBoundingClientRect();
  const style =
    window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden'
  );
}

function findTopBadgeButton(
  root: HTMLElement,
) {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      INTERACTIVE_SELECTOR,
    ),
  )
    .filter(isVisible)
    .filter((element) => {
      const rect =
        element.getBoundingClientRect();

      return (
        rect.left < 110 &&
        rect.top >= 64 &&
        rect.width >= 34 &&
        rect.width <= 90 &&
        rect.height >= 34 &&
        rect.height <= 90
      );
    })
    .sort(
      (a, b) =>
        a.getBoundingClientRect().top -
        b.getBoundingClientRect().top,
    );

  return candidates[0] ?? root;
}

function resolveBadgeContext(
  start: HTMLElement,
): BadgeContext | null {
  let current: HTMLElement | null =
    start;
  let fallbackRoot: HTMLElement | null =
    null;

  for (
    let depth = 0;
    current && depth < 10;
    depth += 1
  ) {
    const rect =
      current.getBoundingClientRect();

    const isLeftBadgeArea =
      rect.left < 280 &&
      rect.right < 330 &&
      rect.top >= 64 &&
      rect.width <= 280 &&
      rect.height <= 620;

    if (isLeftBadgeArea) {
      const label =
        getElementLabel(current);

      const hasKnownLabel =
        QUICK_BADGE_WORDS.some(
          (word) =>
            label.includes(word),
        );

      const interactiveCount =
        current.querySelectorAll(
          INTERACTIVE_SELECTOR,
        ).length;

      const style =
        window.getComputedStyle(current);

      if (
        hasKnownLabel ||
        interactiveCount >= 2
      ) {
        fallbackRoot = current;
      }

      if (
        style.position === 'fixed' &&
        (
          hasKnownLabel ||
          interactiveCount >= 2
        )
      ) {
        return {
          root: current,
          anchor:
            findTopBadgeButton(current),
        };
      }
    }

    current =
      current.parentElement;
  }

  if (!fallbackRoot) {
    return null;
  }

  return {
    root: fallbackRoot,
    anchor:
      findTopBadgeButton(fallbackRoot),
  };
}

function findBadgeContextAtPoint(
  clientX: number,
  clientY: number,
) {
  if (
    clientY < 64 ||
    clientX > 290
  ) {
    return null;
  }

  const elements =
    document.elementsFromPoint(
      clientX,
      clientY,
    );

  for (const element of elements) {
    if (
      !(element instanceof HTMLElement)
    ) {
      continue;
    }

    const context =
      resolveBadgeContext(element);

    if (context) {
      return context;
    }
  }

  return null;
}

function parseTimeList(
  value: string,
) {
  return value
    .split(',')
    .map((entry) => {
      const normalized =
        entry.trim();

      if (
        normalized.endsWith('ms')
      ) {
        return (
          Number.parseFloat(
            normalized,
          ) || 0
        );
      }

      if (
        normalized.endsWith('s')
      ) {
        return (
          (
            Number.parseFloat(
              normalized,
            ) || 0
          ) * 1000
        );
      }

      return 0;
    });
}

function readTransitionMs(
  root: HTMLElement,
) {
  const elements = [
    root,
    ...Array.from(
      root.querySelectorAll<HTMLElement>(
        '*',
      ),
    ),
  ];

  let maxMs = 0;

  for (const element of elements) {
    const style =
      window.getComputedStyle(element);

    const durations =
      parseTimeList(
        style.transitionDuration,
      );

    const delays =
      parseTimeList(
        style.transitionDelay,
      );

    const entryCount = Math.max(
      durations.length,
      delays.length,
    );

    for (
      let index = 0;
      index < entryCount;
      index += 1
    ) {
      const duration =
        durations[
          index % durations.length
        ] ?? 0;

      const delay =
        delays[
          index % delays.length
        ] ?? 0;

      maxMs = Math.max(
        maxMs,
        duration + delay,
      );
    }
  }

  if (
    !Number.isFinite(maxMs) ||
    maxMs <= 0
  ) {
    return DEFAULT_TRANSITION_MS;
  }

  return Math.min(
    Math.max(
      Math.round(maxMs),
      100,
    ),
    400,
  );
}

export default function DocBadgeModeSwitcher() {
  const [
    isMounted,
    setIsMounted,
  ] = useState(false);

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    mode,
    setMode,
  ] = useState<DocBadgeMode>('quick');

  const [
    position,
    setPosition,
  ] = useState<SwitcherPosition>({
    left: 46,
    top: 104,
  });

  const [
    transitionMs,
    setTransitionMs,
  ] = useState(
    DEFAULT_TRANSITION_MS,
  );

  const switcherRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const badgeRootRef =
    useRef<HTMLElement | null>(
      null,
    );

  const badgeAnchorRef =
    useRef<HTMLElement | null>(
      null,
    );

  const openRef =
    useRef(false);

  const setOpenState =
    useCallback((nextOpen: boolean) => {
      if (
        openRef.current === nextOpen
      ) {
        return;
      }

      openRef.current = nextOpen;
      setIsOpen(nextOpen);
    }, []);

  const updatePosition =
    useCallback(
      (
        anchor =
          badgeAnchorRef.current,
      ) => {
        if (
          !anchor ||
          !anchor.isConnected
        ) {
          return;
        }

        const rect =
          anchor.getBoundingClientRect();

        setPosition((previous) => {
          const next = {
            left:
              rect.left +
              rect.width / 2,
            top: rect.top - 8,
          };

          if (
            Math.abs(
              previous.left -
              next.left,
            ) < 0.5 &&
            Math.abs(
              previous.top -
              next.top,
            ) < 0.5
          ) {
            return previous;
          }

          return next;
        });
      },
      [],
    );

  const rememberBadgeContext =
    useCallback(
      (context: BadgeContext) => {
        badgeRootRef.current =
          context.root;

        badgeAnchorRef.current =
          context.anchor;

        updatePosition(
          context.anchor,
        );

        setTransitionMs(
          readTransitionMs(
            context.root,
          ),
        );
      },
      [updatePosition],
    );

  useEffect(() => {
    setIsMounted(true);
    setMode(readBadgeMode());

    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    const syncMode = () => {
      setMode(readBadgeMode());
    };

    const onStorage = (
      event: StorageEvent,
    ) => {
      if (
        event.key ===
        BADGE_MODE_STORAGE
      ) {
        syncMode();
      }
    };

    window.addEventListener(
      'storage',
      onStorage,
    );

    window.addEventListener(
      BADGE_MODE_EVENT,
      syncMode,
    );

    return () => {
      window.removeEventListener(
        'storage',
        onStorage,
      );

      window.removeEventListener(
        BADGE_MODE_EVENT,
        syncMode,
      );
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (
      event: PointerEvent,
    ) => {
      const switcher =
        switcherRef.current;

      if (
        switcher &&
        event.target instanceof Node &&
        switcher.contains(
          event.target,
        )
      ) {
        setOpenState(true);
        return;
      }

      const context =
        findBadgeContextAtPoint(
          event.clientX,
          event.clientY,
        );

      if (context) {
        rememberBadgeContext(
          context,
        );

        setOpenState(true);
        return;
      }

      setOpenState(false);
    };

    const onPointerLeave = () => {
      setOpenState(false);
    };

    document.addEventListener(
      'pointermove',
      onPointerMove,
      {
        passive: true,
      },
    );

    document.documentElement.addEventListener(
      'pointerleave',
      onPointerLeave,
    );

    return () => {
      document.removeEventListener(
        'pointermove',
        onPointerMove,
      );

      document.documentElement.removeEventListener(
        'pointerleave',
        onPointerLeave,
      );
    };
  }, [
    rememberBadgeContext,
    setOpenState,
  ]);

  useEffect(() => {
    const onViewportChange = () => {
      updatePosition();
    };

    window.addEventListener(
      'resize',
      onViewportChange,
    );

    window.addEventListener(
      'scroll',
      onViewportChange,
      true,
    );

    return () => {
      window.removeEventListener(
        'resize',
        onViewportChange,
      );

      window.removeEventListener(
        'scroll',
        onViewportChange,
        true,
      );
    };
  }, [updatePosition]);

  const toggleMode = () => {
    const nextMode: DocBadgeMode =
      mode === 'quick'
        ? 'favorites'
        : 'quick';

    window.localStorage.setItem(
      BADGE_MODE_STORAGE,
      nextMode,
    );

    setMode(nextMode);

    /*
     * 같은 탭에서는 native storage 이벤트가 자동 발생하지 않는다.
     * 기존 문서 영역이 어느 이벤트를 사용하더라도 즉시 반영되도록
     * storage 이벤트와 프로젝트 커스텀 이벤트를 함께 보낸다.
     */
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: BADGE_MODE_STORAGE,
        oldValue: mode,
        newValue: nextMode,
        storageArea:
          window.localStorage,
      }),
    );

    window.dispatchEvent(
      new CustomEvent(
        BADGE_MODE_EVENT,
        {
          detail: {
            mode: nextMode,
          },
        },
      ),
    );

    document.documentElement.setAttribute(
      'data-doc-badge-mode',
      nextMode,
    );

    window.requestAnimationFrame(
      () => {
        const root =
          badgeRootRef.current;

        if (
          root &&
          root.isConnected
        ) {
          badgeAnchorRef.current =
            findTopBadgeButton(root);

          updatePosition();
        }
      },
    );
  };

  if (!isMounted) {
    return null;
  }

  const nextModeLabel =
    mode === 'quick'
      ? '즐겨찾기'
      : '바로가기';

  const currentModeLabel =
    mode === 'quick'
      ? '바로가기'
      : '즐겨찾기';

  return createPortal(
    <div
      ref={switcherRef}
      className={`${styles.switcher} ${
        isOpen
          ? styles.switcherOpen
          : ''
      }`}
      style={
        {
          left: position.left,
          top: position.top,
          '--badge-transition-ms':
            `${transitionMs}ms`,
        } as CSSProperties
      }
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className={
          styles.switchButton
        }
        onClick={toggleMode}
        tabIndex={isOpen ? 0 : -1}
        aria-label={`${currentModeLabel}에서 ${nextModeLabel}로 전환`}
        title={`${nextModeLabel}로 전환`}
      >
        <span
          className={
            styles.switchIcon
          }
          aria-hidden="true"
        >
          {mode === 'quick'
            ? '★'
            : '⚡'}
        </span>

        <span
          className={
            styles.switchLabel
          }
        >
          {nextModeLabel}
        </span>
      </button>

      <span
        className={styles.bridge}
        aria-hidden="true"
      />
    </div>,
    document.body,
  );
}
