// =============================================
// File: app/components/wiki/DocBadgeModeSwitcher.tsx
// 전체 코드
// - 실제 .wiki-quick-badges-wrap 내부의 .qbd-root만 감지
// - 카테고리/본문 요소를 바로가기 배지로 오인하는 문제 제거
// - 전환 버튼을 실제 .qbd-main 버튼 위에 고정
// - 기존 transition 시간과 localStorage 이벤트 유지
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

const BADGE_ROOT_SELECTOR =
  '.wiki-quick-badges-wrap .qbd-root';

const BADGE_ANCHOR_SELECTOR =
  '.qbd-main';

  const BADGE_MODE_STORAGE =
  'wiki:doc-badge-mode';

const BADGE_MODE_EVENT =
  'wiki-doc-badge-mode-change';

const DEFAULT_TRANSITION_MS = 180;

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
  const root =
    document.querySelector<HTMLElement>(
      BADGE_ROOT_SELECTOR,
    );

  if (
    !root ||
    !root.isConnected ||
    !isVisible(root)
  ) {
    return null;
  }

  return root;
}

function findBadgeAnchor(
  root: HTMLElement,
) {
  const mainButton =
    root.querySelector<HTMLElement>(
      BADGE_ANCHOR_SELECTOR,
    );

  if (
    mainButton &&
    mainButton.isConnected
  ) {
    return mainButton;
  }

  return root;
}

function isInsideElement(
  target: EventTarget | null,
  element: HTMLElement | null,
) {
  return (
    Boolean(element) &&
    target instanceof Node &&
    element!.contains(target)
  );
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
    let observedRoot:
      | HTMLElement
      | null = null;

    const syncBadgeElements = () => {
      const nextRoot =
        findBadgeRoot();

      if (
        nextRoot === observedRoot &&
        nextRoot === badgeRootRef.current
      ) {
        return;
      }

      observedRoot = nextRoot;
      badgeRootRef.current =
        nextRoot;
      badgeAnchorRef.current =
        nextRoot
          ? findBadgeAnchor(
              nextRoot,
            )
          : null;

      if (nextRoot) {
        setTransitionMs(
          readTransitionMs(
            nextRoot,
          ),
        );

        updatePosition(
          badgeAnchorRef.current,
        );
      } else {
        setOpenState(false);
      }
    };

    syncBadgeElements();

    const observer =
      new MutationObserver(() => {
        const currentRoot =
          badgeRootRef.current;

        if (
          !currentRoot ||
          !currentRoot.isConnected
        ) {
          syncBadgeElements();
          return;
        }

        const nextAnchor =
          findBadgeAnchor(
            currentRoot,
          );

        if (
          nextAnchor !==
          badgeAnchorRef.current
        ) {
          badgeAnchorRef.current =
            nextAnchor;

          updatePosition(
            nextAnchor,
          );
        }
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      },
    );

    const onPointerMove = (
      event: PointerEvent,
    ) => {
      const root =
        badgeRootRef.current;
      const switcher =
        switcherRef.current;

      if (
        isInsideElement(
          event.target,
          switcher,
        )
      ) {
        setOpenState(true);
        return;
      }

      if (
        isInsideElement(
          event.target,
          root,
        )
      ) {
        const anchor =
          root
            ? findBadgeAnchor(
                root,
              )
            : null;

        badgeAnchorRef.current =
          anchor;

        updatePosition(
          anchor,
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
      observer.disconnect();

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
    setOpenState,
    updatePosition,
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
            findBadgeAnchor(root);

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
