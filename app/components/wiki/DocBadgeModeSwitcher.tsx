// =============================================
// File: app/components/wiki/DocBadgeModeSwitcher.tsx
// 전체 코드
// - 기존 바로가기 배지를 DOM 자동 검색 실패 없이 감지
// - 바로가기 영역에 마우스를 올리면 전환 버튼을 위쪽에 표시
// - 같은 탭에서도 WikiPageInner 상태가 즉시 갱신되도록 이벤트 전달
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

const BADGE_MODE_STORAGE =
  'wiki:doc-badge-mode';

const BADGE_MODE_EVENT =
  'wiki-doc-badge-mode-change';

const QUICK_BADGE_WORDS = [
  '바로가기',
  '즐겨찾기',
  '퀘스트',
  '상점',
  '도감',
  '계산기',
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

function isQuickBadgeElement(
  element: HTMLElement,
) {
  let current: HTMLElement | null =
    element;

  for (
    let depth = 0;
    current && depth < 9;
    depth += 1
  ) {
    const rect =
      current.getBoundingClientRect();

    const isLeftArea =
      rect.left < 270 &&
      rect.right < 320 &&
      rect.top >= 64;

    if (isLeftArea) {
      const label =
        getElementLabel(current);

      const hasQuickBadgeWord =
        QUICK_BADGE_WORDS.some(
          (word) =>
            label.includes(word),
        );

      const style =
        window.getComputedStyle(current);

      const looksLikeFixedBadge =
        style.position === 'fixed' &&
        rect.width <= 260 &&
        rect.height <= 520 &&
        Boolean(
          current.querySelector(
            'button, a, [role="button"]',
          ),
        );

      if (
        hasQuickBadgeWord ||
        looksLikeFixedBadge
      ) {
        return true;
      }
    }

    current =
      current.parentElement;
  }

  return false;
}

function isPointerOnQuickBadge(
  clientX: number,
  clientY: number,
) {
  if (
    clientY < 64 ||
    clientX > 280
  ) {
    return false;
  }

  const elements =
    document.elementsFromPoint(
      clientX,
      clientY,
    );

  for (const element of elements) {
    if (
      element instanceof HTMLElement &&
      isQuickBadgeElement(element)
    ) {
      return true;
    }
  }

  /*
   * 닫힌 상태의 검은 원형 배지는 내부 텍스트가 없을 수 있다.
   * 화면 왼쪽의 좁은 아이콘 열에서는 해당 위치 자체를
   * 바로가기 영역으로 인정한다.
   */
  return (
    clientX >= 8 &&
    clientX <= 88 &&
    clientY >= 92 &&
    clientY <= 430
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

  const switcherHoveredRef =
    useRef(false);
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

  const openSwitcher =
    useCallback(() => {
      clearCloseTimer();
      setIsOpen(true);
    }, [clearCloseTimer]);

  const closeSwitcherSoon =
    useCallback(() => {
      clearCloseTimer();

      closeTimerRef.current =
        window.setTimeout(() => {
          if (
            !switcherHoveredRef.current
          ) {
            setIsOpen(false);
          }

          closeTimerRef.current = null;
        }, 150);
    }, [clearCloseTimer]);

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
      if (
        isPointerOnQuickBadge(
          event.clientX,
          event.clientY,
        )
      ) {
        openSwitcher();
        return;
      }

      if (
        !switcherHoveredRef.current
      ) {
        closeSwitcherSoon();
      }
    };

    const onPointerLeave = () => {
      if (
        !switcherHoveredRef.current
      ) {
        closeSwitcherSoon();
      }
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
    closeSwitcherSoon,
    openSwitcher,
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

    /*
     * 같은 탭에서는 native storage 이벤트가 자동으로 발생하지 않는다.
     * 기존 WikiPageInner가 storage/custom event 중 어느 쪽을
     * 사용하더라도 즉시 반영되도록 둘 다 전달한다.
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
      aria-hidden={!isOpen}
      onPointerEnter={() => {
        switcherHoveredRef.current =
          true;
        openSwitcher();
      }}
      onPointerLeave={() => {
        switcherHoveredRef.current =
          false;
        closeSwitcherSoon();
      }}
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