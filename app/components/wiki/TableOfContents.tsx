// =============================================
// File: app/components/wiki/TableOfContents.tsx
// 전체 코드
//
// - 기존 문서 목차의 이동/활성 추적 기능 유지
// - 시각 디자인을 inline style에서 wikiShell.css로 이동
// - 홈 화면과 같은 초록·민트 계열 카드 디자인 적용
// - 라이트/다크 모드 디자인은 CSS 한 곳에서 관리
// =============================================

'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
  faAlignLeft,
} from '@fortawesome/free-solid-svg-icons';

type Heading = {
  text: string;
  id: string;
  domId?: string;
  occ?: number;
  level: 1 | 2 | 3;
  icon?: string;
};

type Props = {
  headings: Heading[];
  headerOffset?: number;
  right?: number;
  top?: number;
  width?: number;
  title?: string;
  docTitle?: string;
  docIcon?: string;
  scrollRootSelector?: string;
  onNavigate?: () => void;
};

type IndexedHeading = Heading & {
  key: string;
  targetId: string;
  occurrence: number;
};

type IndicatorStyle = {
  top: number;
  height: number;
  visible: boolean;
};

const DEFAULT_HEADER_OFFSET = 84;
const DEFAULT_RIGHT = 16;
const DEFAULT_TOP = 96;
const DEFAULT_WIDTH = 222;
const HASH_RETRY_LIMIT = 16;
const HASH_RETRY_DELAY = 90;
const PROGRAMMATIC_LOCK_MS = 520;

function normalizeHash(
  value: string,
) {
  const raw =
    value.startsWith('#')
      ? value.slice(1)
      : value;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function getScrollableParent(
  element: HTMLElement | null,
) {
  let current =
    element?.parentElement ?? null;

  while (current) {
    const style =
      window.getComputedStyle(current);
    const overflowY =
      style.overflowY;

    if (
      (
        overflowY === 'auto' ||
        overflowY === 'scroll'
      ) &&
      current.scrollHeight >
        current.clientHeight
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getScrollRoot(
  selector?: string,
) {
  if (selector) {
    const selected =
      document.querySelector<HTMLElement>(
        selector,
      );

    if (selected) {
      return selected;
    }
  }

  return (
    document.querySelector<HTMLElement>(
      '#wiki-scroll-root',
    ) ??
    document.querySelector<HTMLElement>(
      '.wiki-main-scrollable',
    ) ??
    null
  );
}

function findHeadingElement(
  heading: IndexedHeading,
) {
  const directId =
    heading.targetId.trim();

  if (directId) {
    const direct =
      document.getElementById(
        directId,
      );

    if (direct) {
      return direct;
    }
  }

  const candidates =
    Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1[id], h2[id], h3[id]',
      ),
    );

  const sameId =
    candidates.filter(
      (element) =>
        element.id === heading.id,
    );

  if (
    sameId[heading.occurrence]
  ) {
    return sameId[
      heading.occurrence
    ];
  }

  return (
    candidates.find(
      (element) =>
        element.textContent?.trim() ===
        heading.text.trim(),
    ) ?? null
  );
}

function getScrollTop(
  root: HTMLElement | null,
) {
  if (root) {
    return root.scrollTop;
  }

  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    0
  );
}

function getElementTop(
  element: HTMLElement,
  root: HTMLElement | null,
) {
  const elementRect =
    element.getBoundingClientRect();

  if (!root) {
    return (
      elementRect.top +
      getScrollTop(null)
    );
  }

  const rootRect =
    root.getBoundingClientRect();

  return (
    elementRect.top -
    rootRect.top +
    root.scrollTop
  );
}

function scrollToElement(
  element: HTMLElement,
  root: HTMLElement | null,
  offset: number,
  behavior: ScrollBehavior,
) {
  const top = Math.max(
    0,
    getElementTop(element, root) -
      offset,
  );

  if (root) {
    root.scrollTo({
      top,
      behavior,
    });
    return;
  }

  window.scrollTo({
    top,
    behavior,
  });
}

function isImageIcon(
  icon?: string,
) {
  if (!icon) {
    return false;
  }

  return (
    icon.startsWith('/') ||
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('data:')
  );
}

function TocIcon({
  icon,
  className,
}: {
  icon?: string;
  className: string;
}) {
  if (!icon) {
    return null;
  }

  if (isImageIcon(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className={className}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

export default function TableOfContents({
  headings,
  headerOffset =
    DEFAULT_HEADER_OFFSET,
  right = DEFAULT_RIGHT,
  top = DEFAULT_TOP,
  width = DEFAULT_WIDTH,
  title = '목차',
  docTitle,
  docIcon,
  scrollRootSelector,
  onNavigate,
}: Props) {
  const listRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const itemRefs =
    useRef<
      Map<string, HTMLButtonElement>
    >(new Map());
  const programmaticUntilRef =
    useRef(0);
  const correctionTimersRef =
    useRef<number[]>([]);

  const [
    activeKey,
    setActiveKey,
  ] = useState<string | null>(
    null,
  );
  const [
    indicator,
    setIndicator,
  ] = useState<IndicatorStyle>({
    top: 0,
    height: 0,
    visible: false,
  });
  const [
    mobileViewport,
    setMobileViewport,
  ] = useState(false);

  const indexedHeadings =
    useMemo<IndexedHeading[]>(
      () => {
        const counts =
          new Map<string, number>();

        return headings.map(
          (heading, index) => {
            const occurrence =
              heading.occ ??
              counts.get(
                heading.id,
              ) ??
              0;

            counts.set(
              heading.id,
              occurrence + 1,
            );

            const targetId =
              heading.domId ??
              (
                occurrence === 0
                  ? heading.id
                  : `${heading.id}-${occurrence}`
              );

            return {
              ...heading,
              occurrence,
              targetId,
              key:
                `${targetId}:${index}`,
            };
          },
        );
      },
      [headings],
    );

  const clearCorrectionTimers =
    useCallback(() => {
      correctionTimersRef.current.forEach(
        (timer) => {
          window.clearTimeout(timer);
        },
      );

      correctionTimersRef.current = [];
    }, []);

  const updateIndicator =
    useCallback(
      (key: string | null) => {
        const list =
          listRef.current;

        if (!key || !list) {
          setIndicator({
            top: 0,
            height: 0,
            visible: false,
          });
          return;
        }

        const item =
          itemRefs.current.get(key);

        if (!item) {
          setIndicator({
            top: 0,
            height: 0,
            visible: false,
          });
          return;
        }

        const listRect =
          list.getBoundingClientRect();
        const itemRect =
          item.getBoundingClientRect();

        setIndicator({
          top:
            itemRect.top -
            listRect.top +
            list.scrollTop,
          height: itemRect.height,
          visible: true,
        });

        const listTop =
          list.scrollTop;
        const listBottom =
          listTop +
          list.clientHeight;
        const itemTop =
          item.offsetTop;
        const itemBottom =
          itemTop +
          item.offsetHeight;

        if (itemTop < listTop) {
          list.scrollTo({
            top:
              Math.max(
                0,
                itemTop - 10,
              ),
            behavior: 'smooth',
          });
        } else if (
          itemBottom > listBottom
        ) {
          list.scrollTo({
            top:
              itemBottom -
              list.clientHeight +
              10,
            behavior: 'smooth',
          });
        }
      },
      [],
    );

  const detectActiveHeading =
    useCallback(() => {
      if (
        Date.now() <
        programmaticUntilRef.current
      ) {
        return;
      }

      const root =
        getScrollRoot(
          scrollRootSelector,
        );
      const currentTop =
        getScrollTop(root) +
        headerOffset +
        24;

      let next:
        | IndexedHeading
        | null = null;

      for (
        const heading
        of indexedHeadings
      ) {
        const element =
          findHeadingElement(heading);

        if (!element) {
          continue;
        }

        const elementTop =
          getElementTop(
            element,
            root,
          );

        if (
          elementTop <= currentTop
        ) {
          next = heading;
          continue;
        }

        break;
      }

      if (
        !next &&
        indexedHeadings.length > 0
      ) {
        next =
          indexedHeadings[0];
      }

      setActiveKey(
        next?.key ?? null,
      );
    }, [
      headerOffset,
      indexedHeadings,
      scrollRootSelector,
    ]);

  const navigateToHeading =
    useCallback(
      (
        heading: IndexedHeading,
        behavior: ScrollBehavior =
          'smooth',
      ) => {
        const element =
          findHeadingElement(
            heading,
          );

        if (!element) {
          return;
        }

        clearCorrectionTimers();

        const root =
          getScrollRoot(
            scrollRootSelector,
          );

        programmaticUntilRef.current =
          Date.now() +
          PROGRAMMATIC_LOCK_MS;

        setActiveKey(
          heading.key,
        );

        scrollToElement(
          element,
          root,
          headerOffset,
          behavior,
        );

        const encoded =
          encodeURIComponent(
            element.id ||
            heading.targetId,
          );

        window.history.replaceState(
          null,
          '',
          `#${encoded}`,
        );

        /*
         * 이미지와 폰트가 늦게 로드되면서 문서 높이가 바뀌는 경우를
         * 보정한다. 기존 목차가 하던 반복 위치 보정 동작을 유지한다.
         */
        [120, 280, 460].forEach(
          (delay) => {
            const timer =
              window.setTimeout(
                () => {
                  const latest =
                    findHeadingElement(
                      heading,
                    );

                  if (!latest) {
                    return;
                  }

                  scrollToElement(
                    latest,
                    getScrollRoot(
                      scrollRootSelector,
                    ),
                    headerOffset,
                    'auto',
                  );
                },
                delay,
              );

            correctionTimersRef.current.push(
              timer,
            );
          },
        );

        onNavigate?.();
      },
      [
        clearCorrectionTimers,
        headerOffset,
        onNavigate,
        scrollRootSelector,
      ],
    );

  useEffect(() => {
    const onResize = () => {
      setMobileViewport(
        window.innerWidth <= 1024,
      );
      updateIndicator(
        activeKey,
      );
    };

    onResize();

    window.addEventListener(
      'resize',
      onResize,
    );

    return () => {
      window.removeEventListener(
        'resize',
        onResize,
      );
    };
  }, [
    activeKey,
    updateIndicator,
  ]);

  useEffect(() => {
    const root =
      getScrollRoot(
        scrollRootSelector,
      );

    const target:
      | HTMLElement
      | Window =
      root ?? window;

    const onScroll = () => {
      window.requestAnimationFrame(
        detectActiveHeading,
      );
    };

    target.addEventListener(
      'scroll',
      onScroll,
      {
        passive: true,
      },
    );

    detectActiveHeading();

    return () => {
      target.removeEventListener(
        'scroll',
        onScroll,
      );
    };
  }, [
    detectActiveHeading,
    scrollRootSelector,
  ]);

  useEffect(() => {
    const onHashChange = () => {
      const hash =
        normalizeHash(
          window.location.hash,
        );

      if (!hash) {
        return;
      }

      const heading =
        indexedHeadings.find(
          (item) =>
            item.targetId === hash ||
            item.id === hash,
        );

      if (heading) {
        navigateToHeading(
          heading,
          'auto',
        );
      }
    };

    window.addEventListener(
      'hashchange',
      onHashChange,
    );

    return () => {
      window.removeEventListener(
        'hashchange',
        onHashChange,
      );
    };
  }, [
    indexedHeadings,
    navigateToHeading,
  ]);

  useEffect(() => {
    const hash =
      normalizeHash(
        window.location.hash,
      );

    if (!hash) {
      return;
    }

    let attempt = 0;
    let timer = 0;

    const retry = () => {
      const heading =
        indexedHeadings.find(
          (item) =>
            item.targetId === hash ||
            item.id === hash,
        );

      if (
        heading &&
        findHeadingElement(
          heading,
        )
      ) {
        navigateToHeading(
          heading,
          'auto',
        );
        return;
      }

      attempt += 1;

      if (
        attempt >=
        HASH_RETRY_LIMIT
      ) {
        return;
      }

      timer =
        window.setTimeout(
          retry,
          HASH_RETRY_DELAY,
        );
    };

    retry();

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    indexedHeadings,
    navigateToHeading,
  ]);

  useLayoutEffect(() => {
    updateIndicator(activeKey);
  }, [
    activeKey,
    indexedHeadings,
    updateIndicator,
  ]);

  useEffect(() => {
    return () => {
      clearCorrectionTimers();
    };
  }, [clearCorrectionTimers]);

  const maxHeight =
    mobileViewport
      ? 'calc(100vh - 96px)'
      : `calc(100vh - ${top + 24}px)`;

  const rootStyle = {
    '--wiki-toc-right':
      `${right}px`,
    '--wiki-toc-top':
      `${top}px`,
    '--wiki-toc-width':
      `${width}px`,
    '--wiki-toc-max-height':
      maxHeight,
  } as CSSProperties;

  const indicatorStyle = {
    '--wiki-toc-indicator-top':
      `${indicator.top}px`,
    '--wiki-toc-indicator-height':
      `${indicator.height}px`,
    opacity:
      indicator.visible
        ? 1
        : 0,
  } as CSSProperties;

  return (
    <aside
      className="wiki-shell-toc"
      style={rootStyle}
      aria-label={title}
    >
      <div className="wiki-shell-toc-heading">
        <span
          className="wiki-shell-toc-heading-icon"
          aria-hidden="true"
        >
          <FontAwesomeIcon
            icon={faAlignLeft}
          />
        </span>

        <strong>{title}</strong>
      </div>

      {docTitle && (
        <div className="wiki-shell-toc-doc">
          <TocIcon
            icon={docIcon}
            className="wiki-shell-toc-doc-icon"
          />

          <span className="wiki-shell-toc-doc-text">
            {docTitle}
          </span>
        </div>
      )}

      {indexedHeadings.length === 0 ? (
        <div className="wiki-shell-toc-empty">
          목차 없음
        </div>
      ) : (
        <div
          ref={listRef}
          className="wiki-shell-toc-list-wrap"
        >
          <span
            className="wiki-shell-toc-indicator"
            style={indicatorStyle}
            aria-hidden="true"
          />

          <nav
            className="wiki-shell-toc-list"
            aria-label={`${title} 항목`}
          >
            {indexedHeadings.map(
              (heading) => {
                const active =
                  heading.key ===
                  activeKey;

                return (
                  <button
                    key={heading.key}
                    ref={(element) => {
                      if (element) {
                        itemRefs.current.set(
                          heading.key,
                          element,
                        );
                      } else {
                        itemRefs.current.delete(
                          heading.key,
                        );
                      }
                    }}
                    type="button"
                    className={[
                      'wiki-shell-toc-item',
                      `wiki-shell-toc-level-${heading.level}`,
                      active
                        ? 'wiki-shell-toc-item-active'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={
                      active
                        ? 'location'
                        : undefined
                    }
                    onClick={() => {
                      navigateToHeading(
                        heading,
                      );
                    }}
                  >
                    <TocIcon
                      icon={heading.icon}
                      className="wiki-shell-toc-icon"
                    />

                    <span className="wiki-shell-toc-text">
                      {heading.text}
                    </span>
                  </button>
                );
              },
            )}
          </nav>
        </div>
      )}
    </aside>
  );
}
