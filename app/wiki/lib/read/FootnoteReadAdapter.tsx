'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import {
  FootnoteInline as SharedFootnoteInline,
} from '@/components/wiki-render/inline';

const FOOTNOTE_HOVER_EVENT = 'rdwiki:footnote-hover';

type FootnoteReadAdapterProps = {
  label?: string | null;
  content?: string | null;
};

export default function FootnoteReadAdapter({
  label,
  content,
}: FootnoteReadAdapterProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const desktopTooltipRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const [desktopTooltipPos, setDesktopTooltipPos] = useState({
    left: 0,
    top: 0,
    arrowLeft: 20,
  });

  const safeLabel = String(label ?? '').trim() || '각주';
  const safeContent = String(content ?? '').trim();
  const hasContent = safeContent.length > 0;

  const notifyFootnoteHover = useCallback(() => {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent(FOOTNOTE_HOVER_EVENT));
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(max-width: 768px)');

    const apply = () => {
      setIsMobileViewport(mq.matches);
    };

    apply();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);

      return () => mq.removeEventListener('change', apply);
    }

    mq.addListener(apply);

    return () => mq.removeListener(apply);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;

      if (!target) return;
      if (isMobileViewport) return;
      if (rootRef.current?.contains(target)) return;
      if (desktopTooltipRef.current?.contains(target)) return;

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, {
      passive: true,
    });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (!open) return;

    const prevOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isMobileViewport]);

  const updateDesktopTooltipPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!rootRef.current || !desktopTooltipRef.current) return;

    const triggerRect = rootRef.current.getBoundingClientRect();
    const tooltipRect = desktopTooltipRef.current.getBoundingClientRect();

    const sidePadding = 12;
    const gap = 10;

    let left =
      triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

    left = Math.max(
      sidePadding,
      Math.min(left, window.innerWidth - sidePadding - tooltipRect.width),
    );

    let top = triggerRect.top - gap - tooltipRect.height;

    top = Math.max(12, top);

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;

    let arrowLeft = triggerCenterX - left;

    arrowLeft = Math.max(14, Math.min(arrowLeft, tooltipRect.width - 14));

    setDesktopTooltipPos({
      left,
      top,
      arrowLeft,
    });
  }, []);

  useLayoutEffect(() => {
    if (!portalReady || !open || isMobileViewport || !hasContent) return;

    let raf = 0;

    const schedule = () => {
      cancelAnimationFrame(raf);

      raf = requestAnimationFrame(() => {
        updateDesktopTooltipPosition();
      });
    };

    schedule();

    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [
    portalReady,
    open,
    isMobileViewport,
    hasContent,
    updateDesktopTooltipPosition,
  ]);

  const openDesktop = () => {
    if (!hasContent || isMobileViewport) return;

    notifyFootnoteHover();
    setOpen(true);
  };

  const closeDesktop = () => {
    if (isMobileViewport) return;

    setOpen(false);
  };

  const openMobileModal = (event: React.MouseEvent) => {
    if (!hasContent || !isMobileViewport) return;

    event.preventDefault();
    event.stopPropagation();

    notifyFootnoteHover();
    setOpen(true);
  };

  const closeMobileModal = () => {
    setOpen(false);
  };

  const showDesktopTooltip =
    portalReady && !isMobileViewport && open && hasContent;

  const desktopTooltip = showDesktopTooltip
    ? createPortal(
        <div
          ref={desktopTooltipRef}
          style={{
            pointerEvents: 'none',
            position: 'fixed',
            left: desktopTooltipPos.left,
            top: desktopTooltipPos.top,
            zIndex: 9998,
            width: 'max-content',
            minWidth: 120,
            maxWidth: 340,
            whiteSpace: 'normal',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-elevated)',
            color: 'var(--foreground)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.55,
            letterSpacing: '-0.1px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: desktopTooltipPos.arrowLeft,
              bottom: -6,
              width: 10,
              height: 10,
              transform: 'translateX(-50%) rotate(45deg)',
              background: 'var(--surface-elevated)',
              borderRight: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}
          />

          {safeContent}
        </div>,
        document.body,
      )
    : null;

  const mobileModal =
    portalReady && isMobileViewport && hasContent
      ? createPortal(
          <div
            onClick={closeMobileModal}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: open ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              background: 'rgba(0,0,0,.45)',
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 'min(420px, calc(100vw - 32px))',
                maxHeight: 'min(70vh, 520px)',
                overflowY: 'auto',
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'var(--surface-elevated)',
                color: 'var(--foreground)',
                boxShadow: 'var(--shadow-lg)',
                padding: '16px 16px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <strong>[{safeLabel}]</strong>

                <button
                  type="button"
                  onClick={closeMobileModal}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    background: 'var(--surface)',
                    color: 'var(--foreground)',
                    padding: '3px 10px',
                    cursor: 'pointer',
                  }}
                >
                  닫기
                </button>
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'keep-all',
                  overflowWrap: 'break-word',
                }}
              >
                {safeContent}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <SharedFootnoteInline
        ref={rootRef}
        mode="read"
        label={safeLabel}
        tabIndex={hasContent ? 0 : -1}
        ariaLabel={hasContent ? `각주: ${safeContent}` : `각주 ${safeLabel}`}
        onMouseEnter={() => {
          notifyFootnoteHover();
          openDesktop();
        }}
        onMouseLeave={closeDesktop}
        onFocus={() => {
          notifyFootnoteHover();
          openDesktop();
        }}
        onBlur={closeDesktop}
        onClick={openMobileModal}
        style={{
          cursor: hasContent
            ? isMobileViewport
              ? 'pointer'
              : 'help'
            : 'default',
        }}
      />

      {desktopTooltip}
      {mobileModal}
    </>
  );
}