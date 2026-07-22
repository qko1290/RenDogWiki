// =============================================
// File: app/components/wiki/DocBadgeModeSwitcher.tsx
// 전체 코드
//
// - DOM 좌표 추측과 elementsFromPoint 탐색 제거
// - 실제 바로가기 루트만 정확히 기준으로 사용
// - 카테고리 항목 위에 잘못 출력되는 현상 제거
// - 기존 바로가기 말풍선과 같은 표시/숨김 속도 사용
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

type DocBadgeMode =
  | 'quick'
  | 'favorites';

type SwitcherPosition = {
  left: number;
  top: number;
};

const BADGE_MODE_STORAGE =
  'wiki:doc-badge-mode';

const BADGE_MODE_EVENT =
  'wiki-doc-badge-mode-change';

const BADGE_ROOT_SELECTOR = [
  '[data-doc-quick-badges-root]',
  '.wiki-quick-badges-wrap',
].join(', ');

const DEFAULT_TRANSITION_MS = 180;
const MIN_TRANSITION_MS = 100;
const MAX_TRANSITION_MS = 400;

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

function findBadgeRoot() {
  const candidates =
    document.querySelectorAll<HTMLElement>(
      BADGE_ROOT_SELECTOR,
    );

  for (const candidate of candidates) {
    if (isVisible(candidate)) {
      return candidate;
    }
  }

  return null;
}

function findBadgeAnchor(
  root: HTMLElement,
) {
  const buttons = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [role="button"]',
    ),
  )
    .filter(isVisible)
    .sort(
      (a, b) =>
        a.getBoundingClientRect().top -
        b.getBoundingClientRect().top,
    );

  return buttons[0] ?? root;
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
  const sampleElements = [
    root,
    ...Array.from(
      root.querySelectorAll<HTMLElement>(
        '*',
      ),
    ),
  ];

  let maxMs = 0;

  for (const element of sampleElements) {
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

    const count = Math.max(
      durations.length,
      delays.length,
    );

    for (
      let index = 0;
      index < count;
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
      MIN_TRANSITION_MS,
    ),
    MAX_TRANSITION_MS,
  );
}

export default function DocBadgeModeSwitcher() {
  const [
    mounted,
    setMounted,
  ] = useState(false);

  const [
    open,
    setOpen,
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
    top: 90,
  });

  const [
    transitionMs,
    setTransitionMs,
  ] = useState(
    DEFAULT_TRANSITION_MS,
  );

  const rootRef =
    useRef<HTMLElement | null>(null);
  const anchorRef =
    useRef<HTMLElement | null>(null);
  const switcherRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const closeTimerRef =
    useRef<number | null>(null);

  const clearCloseTimer =
    useCallback(() => {
      if (
        closeTimerRef.current === null
      ) {
        return;
      }

      window.clearTimeout(
        closeTimerRef.current,
      );
      closeTimerRef.current = null;
    }, []);

  const updatePosition =
    useCallback(() => {
      const root = rootRef.current;
      const anchor =
        anchorRef.current;

      if (
        !root ||
        !anchor ||
        !root.isConnected ||
        !anchor.isConnected
      ) {
        return;
      }

      const anchorRect =
        anchor.getBoundingClientRect();

      setPosition({
        left:
          anchorRect.left +
          anchorRect.width / 2,
        top:
          anchorRect.top - 7,
      });
    }, []);

  const show =
    useCallback(() => {
      clearCloseTimer();
      updatePosition();
      setOpen(true);
    }, [
      clearCloseTimer,
      updatePosition,
    ]);

  const hideAfterMatchingDelay =
    useCallback(() => {
      clearCloseTimer();

      closeTimerRef.current =
        window.setTimeout(() => {
          setOpen(false);
          closeTimerRef.current = null;
        }, transitionMs);
    }, [
      clearCloseTimer,
      transitionMs,
    ]);

  useEffect(() => {
    setMounted(true);
    setMode(readBadgeMode());

    return () => {
      setMounted(false);
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
    let boundRoot:
      | HTMLElement
      | null = null;

    const detach = () => {
      if (!boundRoot) {
        return;
      }

      boundRoot.removeEventListener(
        'mouseenter',
        show,
      );
      boundRoot.removeEventListener(
        'mouseleave',
        hideAfterMatchingDelay,
      );
      boundRoot.removeEventListener(
        'focusin',
        show,
      );
      boundRoot.removeEventListener(
        'focusout',
        hideAfterMatchingDelay,
      );

      boundRoot = null;
      rootRef.current = null;
      anchorRef.current = null;
    };

    const attach = () => {
      const nextRoot =
        findBadgeRoot();

      if (
        !nextRoot ||
        nextRoot === boundRoot
      ) {
        return;
      }

      detach();

      boundRoot = nextRoot;
      rootRef.current = nextRoot;
      anchorRef.current =
        findBadgeAnchor(nextRoot);

      setTransitionMs(
        readTransitionMs(nextRoot),
      );
      updatePosition();

      nextRoot.addEventListener(
        'mouseenter',
        show,
      );
      nextRoot.addEventListener(
        'mouseleave',
        hideAfterMatchingDelay,
      );
      nextRoot.addEventListener(
        'focusin',
        show,
      );
      nextRoot.addEventListener(
        'focusout',
        hideAfterMatchingDelay,
      );
    };

    attach();

    const observer =
      new MutationObserver(() => {
        if (
          !boundRoot ||
          !boundRoot.isConnected
        ) {
          attach();
          return;
        }

        const nextAnchor =
          findBadgeAnchor(boundRoot);

        if (
          nextAnchor !==
          anchorRef.current
        ) {
          anchorRef.current =
            nextAnchor;
          updatePosition();
        }
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      },
    );

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
      observer.disconnect();
      detach();

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
  }, [
    hideAfterMatchingDelay,
    show,
    updatePosition,
  ]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

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
          rootRef.current;

        if (
          root &&
          root.isConnected
        ) {
          anchorRef.current =
            findBadgeAnchor(root);
          updatePosition();
        }
      },
    );
  };

  if (!mounted) {
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
      className={`wiki-badge-switcher ${
        open
          ? 'wiki-badge-switcher-open'
          : ''
      }`}
      style={
        {
          left: position.left,
          top: position.top,
          '--wiki-badge-transition':
            `${transitionMs}ms`,
        } as CSSProperties
      }
      aria-hidden={!open}
      onMouseEnter={show}
      onMouseLeave={
        hideAfterMatchingDelay
      }
      onFocus={show}
      onBlur={
        hideAfterMatchingDelay
      }
    >
      <button
        type="button"
        className="wiki-badge-switcher-button"
        onClick={toggleMode}
        tabIndex={open ? 0 : -1}
        aria-label={`${currentModeLabel}에서 ${nextModeLabel}로 전환`}
        title={`${nextModeLabel}로 전환`}
      >
        <span
          className="wiki-badge-switcher-icon"
          aria-hidden="true"
        >
          {mode === 'quick'
            ? '★'
            : '⚡'}
        </span>

        <span>
          {nextModeLabel}
        </span>
      </button>

      <span
        className="wiki-badge-switcher-bridge"
        aria-hidden="true"
      />
    </div>,
    document.body,
  );
}
