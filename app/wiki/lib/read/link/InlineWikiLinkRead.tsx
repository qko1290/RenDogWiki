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
import InlineLinkRenderer from '@/components/wiki-render/link/InlineLinkRenderer';
import {
  normalizeToAppHref,
} from '@/components/wiki-render/link/linkUtils';

import { cdn, withVersion } from '@lib/cdn';

import '../../../css/document-components/internal-link-preview.css';

import {
  FOOTNOTE_HOVER_EVENT,
} from '../readInteractionEvents';
import type {
  InlineWikiLinkReadProps,
  WikiLinkPreviewData,
} from './types';
import {
  getWikiLinkPreviewData,
} from './wikiLinkPreviewService';

type PreviewState = 'idle' | 'loading' | 'ready' | 'error';

type TooltipPosition = {
  left: number;
  top: number;
  arrowLeft: number;
};

function looksLikeImageIcon(icon: string) {
  const value = String(icon ?? '').trim();

  if (!value) return false;

  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/api/') ||
    value.startsWith('/uploads/') ||
    value.startsWith('/images/') ||
    value.startsWith('/_next/') ||
    /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value)
  );
}

function PreviewDocumentIcon({
  icon,
}: {
  icon: string | null;
}) {
  const safeIcon = String(icon ?? '').trim();

  if (!safeIcon) {
    return (
      <svg
        className="wiki-internal-preview-default-icon"
        viewBox="0 0 24 24"
        aria-hidden
        focusable="false"
      >
        <path
          d="M6.75 3.75h7.1L18 7.9v12.35H6.75V3.75Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 3.9v4.35h4.35M9.25 12h6.2M9.25 15.25h4.65"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (looksLikeImageIcon(safeIcon)) {
    return (
      <SmartImage
        src={withVersion(cdn(safeIcon))}
        alt=""
        width={28}
        height={28}
        className="wiki-internal-preview-icon-image"
      />
    );
  }

  return (
    <span className="wiki-internal-preview-icon-text">
      {safeIcon}
    </span>
  );
}

function PreviewStatus({
  state,
}: {
  state: Exclude<PreviewState, 'idle' | 'ready'>;
}) {
  if (state === 'error') {
    return (
      <div className="wiki-internal-preview-status wiki-internal-preview-status--error">
        <span
          className="wiki-internal-preview-status-icon"
          aria-hidden
        >
          !
        </span>

        <span>
          <strong>문서 정보를 불러오지 못했습니다.</strong>
          <small>링크에 다시 마우스를 올리면 재시도합니다.</small>
        </span>
      </div>
    );
  }

  return (
    <div className="wiki-internal-preview-status wiki-internal-preview-status--loading">
      <span
        className="wiki-internal-preview-spinner"
        aria-hidden
      />

      <span>
        <strong>문서 정보를 불러오는 중</strong>
        <small>잠시만 기다려 주세요.</small>
      </span>
    </div>
  );
}

function PreviewContent({
  preview,
}: {
  preview: WikiLinkPreviewData;
}) {
  const visibleTags = preview.tags.slice(0, 3);
  const hiddenTagCount = Math.max(
    preview.tags.length - visibleTags.length,
    0,
  );

  return (
    <div className="wiki-internal-preview-content">
      <div className="wiki-internal-preview-main">
        <span className="wiki-internal-preview-icon">
          <PreviewDocumentIcon icon={preview.icon} />
        </span>

        <span className="wiki-internal-preview-text">
          <span
            className="wiki-internal-preview-category"
            title={preview.categoryLabel}
          >
            {preview.categoryLabel || 'RenDog Wiki'}
          </span>

          <strong className="wiki-internal-preview-title">
            {preview.title}
          </strong>
        </span>
      </div>

      {visibleTags.length > 0 ? (
        <div className="wiki-internal-preview-tags">
          {visibleTags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="wiki-internal-preview-tag"
            >
              #{tag.replace(/^#+/, '')}
            </span>
          ))}

          {hiddenTagCount > 0 ? (
            <span className="wiki-internal-preview-tag-count">
              +{hiddenTagCount}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="wiki-internal-preview-footer">
        <span>내부 문서로 이동</span>

        <svg
          viewBox="0 0 20 20"
          aria-hidden
          focusable="false"
        >
          <path
            d="M6.75 10h6.5M10.75 6.5 14.25 10l-3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default function InlineWikiLinkRead({
  href,
  children,
  onWikiNavigate,
  onBeforeNavigate,
}: InlineWikiLinkReadProps) {
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
  const [preview, setPreview] =
    useState<WikiLinkPreviewData | null>(null);
  const [previewState, setPreviewState] =
    useState<PreviewState>('idle');
  const [tooltipPos, setTooltipPos] =
    useState<TooltipPosition>({
      left: 0,
      top: 0,
      arrowLeft: 24,
    });
  const [tooltipMeasured, setTooltipMeasured] = useState(false);

  const normalizedHref = useMemo(
    () => normalizeToAppHref(href),
    [href],
  );

  const clearPreviewTimeout = useCallback(() => {
    if (
      previewTimeoutRef.current != null &&
      typeof window !== 'undefined'
    ) {
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

    const mediaQuery = window.matchMedia('(max-width: 768px)');

    const applyViewportState = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    applyViewportState();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener(
        'change',
        applyViewportState,
      );

      return () => {
        mediaQuery.removeEventListener(
          'change',
          applyViewportState,
        );
      };
    }

    mediaQuery.addListener(applyViewportState);

    return () => {
      mediaQuery.removeListener(applyViewportState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFootnoteHover = () => {
      clearPreviewTimeout();
      setOpen(false);
    };

    window.addEventListener(
      FOOTNOTE_HOVER_EVENT,
      handleFootnoteHover,
    );

    return () => {
      window.removeEventListener(
        FOOTNOTE_HOVER_EVENT,
        handleFootnoteHover,
      );
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

    const requestSequence = ++previewReqSeqRef.current;

    setPreviewState('loading');
    clearPreviewTimeout();

    if (typeof window !== 'undefined') {
      previewTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        if (
          previewReqSeqRef.current !== requestSequence
        ) {
          return;
        }

        setPreviewState('error');
      }, 6000);
    }

    getWikiLinkPreviewData(normalizedHref)
      .then((data) => {
        if (!mountedRef.current) return;
        if (
          previewReqSeqRef.current !== requestSequence
        ) {
          return;
        }

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
        if (
          previewReqSeqRef.current !== requestSequence
        ) {
          return;
        }

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
  }, [
    beginPreviewLoad,
    isMobileViewport,
    open,
    preview,
    previewState,
  ]);

  const updateTooltipPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!rootRef.current || !tooltipRef.current) return;

    const triggerRect =
      rootRef.current.getBoundingClientRect();
    const tooltipRect =
      tooltipRef.current.getBoundingClientRect();

    const sidePadding = 12;
    const gap = 10;

    let left =
      triggerRect.left +
      triggerRect.width / 2 -
      tooltipRect.width / 2;

    left = Math.max(
      sidePadding,
      Math.min(
        left,
        window.innerWidth -
          sidePadding -
          tooltipRect.width,
      ),
    );

    let top =
      triggerRect.top -
      gap -
      tooltipRect.height;

    top = Math.max(12, top);

    const triggerCenterX =
      triggerRect.left +
      triggerRect.width / 2;

    let arrowLeft =
      triggerCenterX - left;

    arrowLeft = Math.max(
      18,
      Math.min(
        arrowLeft,
        tooltipRect.width - 18,
      ),
    );

    setTooltipPos({
      left,
      top,
      arrowLeft,
    });
    setTooltipMeasured(true);
  }, []);

  useLayoutEffect(() => {
    if (
      !portalReady ||
      !open ||
      isMobileViewport
    ) {
      return;
    }

    let animationFrame = 0;

    const schedulePositionUpdate = () => {
      cancelAnimationFrame(animationFrame);

      animationFrame = requestAnimationFrame(() => {
        updateTooltipPosition();
      });
    };

    schedulePositionUpdate();

    window.addEventListener(
      'resize',
      schedulePositionUpdate,
    );
    window.addEventListener(
      'scroll',
      schedulePositionUpdate,
      true,
    );

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener(
        'resize',
        schedulePositionUpdate,
      );
      window.removeEventListener(
        'scroll',
        schedulePositionUpdate,
        true,
      );
    };
  }, [
    isMobileViewport,
    open,
    portalReady,
    previewState,
    updateTooltipPosition,
  ]);

  const handleClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
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

  const showTooltip =
    portalReady &&
    !isMobileViewport &&
    open;

  const tooltipVisible =
    showTooltip &&
    tooltipMeasured;

  const tooltipContent =
    previewState === 'error' ? (
      <PreviewStatus state="error" />
    ) : previewState === 'loading' ||
      !preview ? (
      <PreviewStatus state="loading" />
    ) : (
      <PreviewContent preview={preview} />
    );

  const tooltipStyle = {
    left: tooltipPos.left,
    top: tooltipPos.top,
    '--wiki-internal-preview-arrow-left':
      `${tooltipPos.arrowLeft}px`,
  } as React.CSSProperties;

  const desktopTooltip = showTooltip
    ? createPortal(
        <div
          ref={tooltipRef}
          id={tooltipIdRef.current}
          role="tooltip"
          aria-hidden={!tooltipVisible}
          data-visible={
            tooltipVisible
              ? 'true'
              : 'false'
          }
          data-state={previewState}
          className="wiki-internal-preview"
          style={tooltipStyle}
        >
          <span
            className="wiki-internal-preview-top-line"
            aria-hidden
          />

          {tooltipContent}

          <span
            className="wiki-internal-preview-arrow"
            aria-hidden
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <InlineLinkRenderer
        anchorRef={rootRef}
        mode="read"
        href={normalizedHref}
        className="wiki-internal-preview-trigger"
        onClick={handleClick}
        onMouseEnter={handlePreviewOpen}
        onMouseLeave={() => setOpen(false)}
        onFocus={handlePreviewOpen}
        onBlur={() => setOpen(false)}
        ariaDescribedBy={
          showTooltip
            ? tooltipIdRef.current
            : undefined
        }
      >
        {children}
      </InlineLinkRenderer>

      {desktopTooltip}
    </>
  );
}
