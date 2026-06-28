"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import SmartImage from '@/components/common/SmartImage';
import { cdn, withVersion } from '@lib/cdn';

import type { InlineWikiLinkProps, WikiLinkPreviewData } from './types';
import { FOOTNOTE_HOVER_EVENT } from './types';
import { getWikiLinkPreviewData } from './linkPreviewService';
import { normalizeToAppHref } from './linkUtils';

export default function InlineWikiLink({
  href,
  children,
  onWikiNavigate,
  onBeforeNavigate,
}: InlineWikiLinkProps) {
  const router = useRouter();

  const rootRef = useRef<HTMLAnchorElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipIdRef = useRef(
    `wiki-inline-preview-${Math.random().toString(36).slice(2, 10)}`,
  );

  const mountedRef = useRef(false);
  const previewReqSeqRef = useRef(0);
  const previewTimeoutRef = useRef<number | null>(null);

  const [portalReady, setPortalReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [preview, setPreview] = useState<WikiLinkPreviewData | null>(null);
  const [previewState, setPreviewState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [tooltipPos, setTooltipPos] = useState({
    left: 0,
    top: 0,
    arrowLeft: 24,
  });
  const [tooltipMeasured, setTooltipMeasured] = useState(false);

  const normalizedHref = useMemo(() => normalizeToAppHref(href), [href]);

  const clearPreviewTimeout = useCallback(() => {
    if (previewTimeoutRef.current != null && typeof window !== 'undefined') {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearPreviewTimeout();
    };
  }, [clearPreviewTimeout]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobileViewport(mq.matches);

    apply();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }

    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFootnoteHover = () => {
      clearPreviewTimeout();
      setOpen(false);
    };

    window.addEventListener(FOOTNOTE_HOVER_EVENT, handleFootnoteHover);

    return () => {
      window.removeEventListener(FOOTNOTE_HOVER_EVENT, handleFootnoteHover);
    };
  }, [clearPreviewTimeout]);

  useEffect(() => {
    previewReqSeqRef.current += 1;
    clearPreviewTimeout();
    setOpen(false);
    setPreviewState('idle');
    setPreview(null);
    setTooltipMeasured(false);
  }, [normalizedHref, clearPreviewTimeout]);

  const beginPreviewLoad = useCallback(() => {
    if (isMobileViewport) return;
    if (previewState === 'ready' && preview) return;
    if (previewState === 'loading') return;

    const reqSeq = ++previewReqSeqRef.current;

    setPreviewState('loading');
    clearPreviewTimeout();

    if (typeof window !== 'undefined') {
      previewTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        if (previewReqSeqRef.current !== reqSeq) return;

        setPreviewState('error');
      }, 6000);
    }

    getWikiLinkPreviewData(normalizedHref)
      .then((data) => {
        if (!mountedRef.current) return;
        if (previewReqSeqRef.current !== reqSeq) return;

        clearPreviewTimeout();

        if (!data) {
          setPreview(null);
          setPreviewState('error');
          return;
        }

        setPreview(data);
        setPreviewState('ready');
      })
      .catch(() => {
        if (!mountedRef.current) return;
        if (previewReqSeqRef.current !== reqSeq) return;

        clearPreviewTimeout();
        setPreview(null);
        setPreviewState('error');
      });
  }, [
    clearPreviewTimeout,
    isMobileViewport,
    normalizedHref,
    preview,
    previewState,
  ]);

  useEffect(() => {
    if (!open || isMobileViewport) return;
    if (previewState === 'ready' && preview) return;

    beginPreviewLoad();
  }, [beginPreviewLoad, isMobileViewport, open, preview, previewState]);

  const updateTooltipPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!rootRef.current || !tooltipRef.current) return;

    const triggerRect = rootRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

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
    arrowLeft = Math.max(16, Math.min(arrowLeft, tooltipRect.width - 16));

    setTooltipPos({
      left,
      top,
      arrowLeft,
    });
    setTooltipMeasured(true);
  }, []);

  useLayoutEffect(() => {
    if (!portalReady || !open || isMobileViewport || previewState === 'error') {
      return;
    }

    let raf = 0;

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        updateTooltipPosition();
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
    isMobileViewport,
    open,
    portalReady,
    previewState,
    updateTooltipPosition,
  ]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const anyEvent = event as any;

    if (
      anyEvent.metaKey ||
      anyEvent.ctrlKey ||
      anyEvent.shiftKey ||
      anyEvent.altKey
    ) {
      return;
    }

    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    setOpen(false);
    onBeforeNavigate?.();

    if (onWikiNavigate) {
      onWikiNavigate(normalizedHref);
      return;
    }

    router.push(normalizedHref);
  };

  const handlePreviewOpen = () => {
    if (isMobileViewport) return;

    clearPreviewTimeout();

    if (previewState === 'error') {
      setPreview(null);
      setPreviewState('idle');
    }

    setTooltipMeasured(false);
    setOpen(true);
  };

  const showTooltip = portalReady && !isMobileViewport && open;
  const tooltipVisible = showTooltip && tooltipMeasured;

  const tooltipContent =
    previewState === 'error' ? (
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--muted)',
          lineHeight: 1.45,
        }}
      >
        문서 정보를 불러오지 못했습니다.
        <br />
        다시 올리면 재시도합니다.
      </div>
    ) : previewState === 'loading' || !preview ? (
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--muted)',
          lineHeight: 1.35,
        }}
      >
        문서 정보를 불러오는 중...
      </div>
    ) : (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--accent-soft)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {preview.icon ? (
            preview.icon.startsWith('http') ? (
              <SmartImage
                src={withVersion(cdn(preview.icon))}
                alt="doc icon"
                width={22}
                height={22}
                style={{
                  width: 22,
                  height: 22,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <span style={{ fontSize: 20, lineHeight: 1 }}>
                {preview.icon}
              </span>
            )
          ) : (
            <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
              📄
            </span>
          )}
        </div>

        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--muted)',
              lineHeight: 1.35,
              letterSpacing: '0.02em',
              marginBottom: 5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={preview.categoryLabel}
          >
            {preview.categoryLabel}
          </div>

          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--foreground)',
              lineHeight: 1.4,
              letterSpacing: '-0.1px',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            }}
          >
            {preview.title}
          </div>

          {preview.tags.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginTop: 9,
              }}
            >
              {preview.tags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: 'rgba(124, 58, 237, 0.10)',
                    border: '1px solid rgba(124, 58, 237, 0.18)',
                    color: 'var(--accent)',
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  #{tag.replace(/^#+/, '')}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );

  const desktopTooltip = showTooltip
    ? createPortal(
        <div
          ref={tooltipRef}
          id={tooltipIdRef.current}
          role="tooltip"
          aria-hidden={!open}
          style={{
            pointerEvents: 'none',
            position: 'fixed',
            left: tooltipPos.left,
            top: tooltipPos.top,
            transform: tooltipVisible ? 'translateY(0)' : 'translateY(6px)',
            opacity: tooltipVisible ? 1 : 0,
            visibility: tooltipVisible ? 'visible' : 'hidden',
            zIndex: 9998,
            width: 'max-content',
            minWidth: 240,
            maxWidth: 360,
            padding: '12px 13px',
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface-elevated)',
            color: 'var(--foreground)',
            boxShadow: 'var(--shadow-lg)',
            transition:
              'opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease',
          }}
        >
          {tooltipContent}

          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: tooltipPos.arrowLeft,
              bottom: -7,
              width: 12,
              height: 12,
              transform: tooltipVisible
                ? 'translateX(-50%) rotate(45deg)'
                : 'translateX(-50%) translateY(-2px) rotate(45deg)',
              opacity: tooltipVisible ? 1 : 0,
              visibility: tooltipVisible ? 'visible' : 'hidden',
              background: 'var(--surface-elevated)',
              borderRight: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              transition:
                'opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease',
            }}
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <a
        ref={rootRef}
        href={normalizedHref}
        onClick={handleClick}
        onMouseEnter={handlePreviewOpen}
        onMouseLeave={() => setOpen(false)}
        onFocus={handlePreviewOpen}
        onBlur={() => setOpen(false)}
        aria-describedby={showTooltip ? tooltipIdRef.current : undefined}
        style={{
          color: 'var(--accent)',
          textDecoration: 'none',
        }}
      >
        {children}
      </a>

      {desktopTooltip}
    </>
  );
}
