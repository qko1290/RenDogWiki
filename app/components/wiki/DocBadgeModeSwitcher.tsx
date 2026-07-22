// =============================================
// File: app/components/wiki/DocBadgeModeSwitcher.tsx
// 전체 코드
// - 기존 왼쪽 바로가기 배지의 hover 영역을 감지
// - 바로가기 목록은 기존처럼 아래쪽으로 펼침
// - 바로가기/즐겨찾기 전환 버튼은 배지 위쪽으로 펼침
// - 기존 localStorage 및 커스텀 이벤트와 연동
// =============================================

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
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

const BADGE_MODE_STORAGE =
  'wiki:doc-badge-mode';

const BADGE_MODE_EVENT =
  'wiki-doc-badge-mode-change';

const BADGE_TEXTS = new Set([
  '바로가기',
  '즐겨찾기',
]);

const EXPLICIT_BADGE_SELECTORS = [
  '[data-doc-quick-badges]',
  '[data-doc-quick-badge]',
  '[data-quick-badges]',
  '[data-quick-badge]',
  '.doc-quick-badges',
  '.doc-quick-badge',
  '.wiki-quick-badges',
  '.wiki-quick-badge',
] as const;

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

function isElementVisible(
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

function findLabelElement() {
  const elements =
    document.querySelectorAll<HTMLElement>(
      'button, a, div, span',
    );

  for (const element of elements) {
    const text =
      element.textContent?.trim();

    if (!text || !BADGE_TEXTS.has(text)) {
      continue;
    }

    if (!isElementVisible(element)) {
      continue;
    }

    const rect =
      element.getBoundingClientRect();

    /*
     * 문서 왼쪽의 고정 배지만 찾는다.
     * 카테고리나 본문에 같은 글자가 있어도
     * 선택되지 않도록 위치를 제한한다.
     */
    if (
      rect.left <= 150 &&
      rect.top >= 64 &&
      rect.width <= 180 &&
      rect.height <= 80
    ) {
      return element;
    }
  }

  return null;
}

function findBadgeRoot() {
  for (
    const selector
    of EXPLICIT_BADGE_SELECTORS
  ) {
    const explicit =
      document.querySelector<HTMLElement>(
        selector,
      );

    if (
      explicit &&
      isElementVisible(explicit)
    ) {
      return explicit;
    }
  }

  const label = findLabelElement();

  if (!label) {
    return null;
  }

  let current: HTMLElement | null =
    label;
  let bestMatch: HTMLElement =
    label;

  for (
    let depth = 0;
    current && depth < 8;
    depth += 1
  ) {
    const rect =
      current.getBoundingClientRect();
    const style =
      window.getComputedStyle(current);

    const isLeftBadgeArea =
      rect.left <= 150 &&
      rect.right <= 240;

    const isReasonableSize =
      rect.width <= 220 &&
      rect.height <= 520;

    if (
      !isLeftBadgeArea ||
      !isReasonableSize
    ) {
      break;
    }

    bestMatch = current;

    if (
      style.position === 'fixed'
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return bestMatch;
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
    left: 0,
    top: 0,
  });

  const targetRef =
    useRef<HTMLElement | null>(null);
  const hideTimerRef =
    useRef<number | null>(null);

  const clearHideTimer =
    useCallback(() => {
      if (
        hideTimerRef.current === null
      ) {
        return;
      }

      window.clearTimeout(
        hideTimerRef.current,
      );

      hideTimerRef.current = null;
    }, []);

  const updatePosition =
    useCallback(() => {
      const target = targetRef.current;

      if (
        !target ||
        !target.isConnected
      ) {
        return;
      }

      const rect =
        target.getBoundingClientRect();

      setPosition({
        left:
          rect.left +
          rect.width / 2,
        top: rect.top - 8,
      });
    }, []);

  const openSwitcher =
    useCallback(() => {
      clearHideTimer();
      updatePosition();
      setIsOpen(true);
    }, [
      clearHideTimer,
      updatePosition,
    ]);

  const closeSwitcherSoon =
    useCallback(() => {
      clearHideTimer();

      hideTimerRef.current =
        window.setTimeout(() => {
          setIsOpen(false);
          hideTimerRef.current = null;
        }, 140);
    }, [clearHideTimer]);

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
    let boundTarget:
      | HTMLElement
      | null = null;

    const unbindTarget = () => {
      if (!boundTarget) {
        return;
      }

      boundTarget.removeEventListener(
        'mouseenter',
        openSwitcher,
      );

      boundTarget.removeEventListener(
        'mouseleave',
        closeSwitcherSoon,
      );

      boundTarget.removeEventListener(
        'focusin',
        openSwitcher,
      );

      boundTarget.removeEventListener(
        'focusout',
        closeSwitcherSoon,
      );

      boundTarget = null;
      targetRef.current = null;
    };

    const bindTarget = () => {
      const nextTarget =
        findBadgeRoot();

      if (
        !nextTarget ||
        nextTarget === boundTarget
      ) {
        return;
      }

      unbindTarget();

      boundTarget = nextTarget;
      targetRef.current = nextTarget;

      boundTarget.addEventListener(
        'mouseenter',
        openSwitcher,
      );

      boundTarget.addEventListener(
        'mouseleave',
        closeSwitcherSoon,
      );

      boundTarget.addEventListener(
        'focusin',
        openSwitcher,
      );

      boundTarget.addEventListener(
        'focusout',
        closeSwitcherSoon,
      );
    };

    bindTarget();

    const observer =
      new MutationObserver(() => {
        if (
          !boundTarget ||
          !boundTarget.isConnected
        ) {
          bindTarget();
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
      if (isOpen) {
        updatePosition();
      }
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
      unbindTarget();

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
    closeSwitcherSoon,
    isOpen,
    openSwitcher,
    updatePosition,
  ]);

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);

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
      new CustomEvent(
        BADGE_MODE_EVENT,
        {
          detail: {
            mode: nextMode,
          },
        },
      ),
    );

    /*
     * 모드가 바뀌면서 기존 배지가 다시 렌더될 수 있으므로
     * 다음 프레임에 기준 위치를 다시 읽는다.
     */
    window.requestAnimationFrame(
      updatePosition,
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
      className={`${styles.switcher} ${
        isOpen
          ? styles.switcherOpen
          : ''
      }`}
      style={{
        left: position.left,
        top: position.top,
      }}
      aria-hidden={!isOpen}
      onMouseEnter={openSwitcher}
      onMouseLeave={closeSwitcherSoon}
      onFocus={openSwitcher}
      onBlur={closeSwitcherSoon}
    >
      <button
        type="button"
        className={styles.switchButton}
        onClick={toggleMode}
        tabIndex={isOpen ? 0 : -1}
        aria-label={`${currentModeLabel}에서 ${nextModeLabel}로 전환`}
        title={`${nextModeLabel}로 전환`}
      >
        <span
          className={styles.switchIcon}
          aria-hidden="true"
        >
          {mode === 'quick'
            ? '★'
            : '⚡'}
        </span>

        <span
          className={styles.switchLabel}
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