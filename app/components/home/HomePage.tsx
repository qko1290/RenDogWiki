// =============================================
// File: app/components/home/HomePage.tsx
// 전체 교체용 코드
// - 문서 화면과 동일한 3열 폭 유지
// - 실제 최근 업데이트 문서 표시
// - 최근 7일 조회수 기준 인기 문서 비동기 표시
// - 최근 7일 열람수 기준 자주 묻는 질문 순위 비동기 표시
// - 실제 선택으로 집계된 최근 7일 인기 검색어 표시
// - Wiki Header와 동일한 SearchBox 사용
// - 퀘스트 NPC 상세 모달과 FAQ 상세 동작 지원
// =============================================

'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';

import SearchBox from '@/components/common/SearchBox';
import NpcDetailModal, {
  type Npc,
} from '@/components/wiki/NpcDetailModal';
import {
  FaqDetailModal,
  type FaqItem,
} from '@/components/wiki/FaqList';
import logo from '@/image/logo.png';
import {
  recordFaqView,
} from '@/wiki/lib/faqView';
import {
  requestSearchQuery,
} from '@/wiki/lib/searchPopularity';

import type {
  HomeCategoryKey,
  HomeCategoryLink,
  HomePopularDocument,
  HomeRecentDocument,
} from './homeData';
import styles from './home.module.css';

const categoryCards: ReadonlyArray<{
  key: HomeCategoryKey;
  title: string;
  description: string;
  icon: string;
  tone: 'green' | 'mint' | 'blue' | 'orange';
}> = [
  {
    key: 'content',
    title: '컨텐츠',
    description:
      '던전, 퀘스트, 이벤트와 생활 컨텐츠 정보를 확인하세요.',
    icon: '🎮',
    tone: 'green',
  },
  {
    key: 'system',
    title: '시스템',
    description:
      '성장, 강화, 거래 등 서버의 주요 시스템을 알아보세요.',
    icon: '⚙️',
    tone: 'mint',
  },
  {
    key: 'price',
    title: '시세표',
    description:
      '아이템 시세와 거래에 필요한 정보를 빠르게 확인하세요.',
    icon: '💎',
    tone: 'blue',
  },
  {
    key: 'policy',
    title: '법전',
    description:
      '서버의 규칙과 운영 기준을 확인할 수 있습니다.',
    icon: '⚖️',
    tone: 'orange',
  },
];

const FAQ_DOCUMENT = {
  id: 71,
  title: '자주 물으시는 질문',
  path: '0',
  special: 'faq',
} as const;

const faqDocumentSearchParams =
  new URLSearchParams({
    id: String(FAQ_DOCUMENT.id),
    path: FAQ_DOCUMENT.path,
    title: FAQ_DOCUMENT.title,
    mode: 'RPG',
  });

const FAQ_DOCUMENT_HREF =
  `/wiki?${faqDocumentSearchParams.toString()}`;

const recommendations = [
  {
    label: '처음 시작한다면',
    title: '뉴비 스타트 가이드',
    description:
      '첫 접속부터 기본 장비 준비까지 순서대로 살펴보세요.',
    icon: '🌱',
  },
  {
    label: '오늘 무엇을 할지 고민된다면',
    title: '추천 콘텐츠 둘러보기',
    description:
      '현재 성장 단계에 맞는 콘텐츠를 확인해 보세요.',
    icon: '🧭',
  },
  {
    label: '성장이 막혔다면',
    title: '장비와 재화 가이드',
    description:
      '강화, 거래, 재화 수급 관련 문서를 모아봤습니다.',
    icon: '🛠️',
  },
] as const;

type HomePageProps = {
  recentDocuments: HomeRecentDocument[];
  categoryLinks: HomeCategoryLink[];
};

type PopularDocumentsResponse = {
  items?: HomePopularDocument[];
};

type HomeFaqRankItem = {
  id: number;
  title: string;
  views: number;
};

type HomeFaqRankingResponse = {
  items?: HomeFaqRankItem[];
};

type HomePopularSearchItem = {
  keyword: string;
  searches: number;
};

type HomePopularSearchResponse = {
  items?: HomePopularSearchItem[];
};

function normalizeNpcPayload(payload: unknown): Npc {
  const raw =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};

  const rawRewards = Array.isArray(raw.rewards)
    ? raw.rewards
    : [];

  const rewards = rawRewards
    .map(
      (
        reward
      ): {
        icon?: string;
        text: string;
      } | null => {
        if (!reward || typeof reward !== 'object') {
          return null;
        }

        const rewardRecord =
          reward as Record<string, unknown>;
        const text = String(
          rewardRecord.text ?? ''
        ).trim();

        if (!text) {
          return null;
        }

        if (rewardRecord.icon) {
          return {
            icon: String(rewardRecord.icon),
            text,
          };
        }

        return { text };
      }
    )
    .filter(
      (
        reward
      ): reward is {
        icon?: string;
        text: string;
      } => reward !== null
    );

  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? '이름 없는 NPC'),
    icon: String(raw.icon ?? ''),
    pictures: Array.isArray(raw.pictures)
      ? raw.pictures.map((picture) => String(picture))
      : [],
    location_x: Number(raw.location_x ?? 0),
    location_y: Number(raw.location_y ?? 0),
    location_z: Number(raw.location_z ?? 0),
    line: raw.line == null
      ? undefined
      : String(raw.line),
    quest: raw.quest == null
      ? undefined
      : String(raw.quest),
    rewards,
    requirement:
      raw.requirement == null
        ? undefined
        : String(raw.requirement),
    tag: raw.tag == null
      ? null
      : String(raw.tag),
  };
}

export default function HomePage({
  recentDocuments,
  categoryLinks,
}: HomePageProps) {
  const categoryHrefByKey =
    new Map<HomeCategoryKey, string>(
      categoryLinks.map(
        (category) => [
          category.key,
          category.href,
        ]
      )
    );

  const getCategoryHref = (
    key: HomeCategoryKey
  ) =>
    categoryHrefByKey.get(key) ??
    '/wiki';
  const [selectedQuestNpc, setSelectedQuestNpc] =
    useState<Npc | null>(null);
  const [loadingQuestNpc, setLoadingQuestNpc] =
    useState(false);
  const [questNpcError, setQuestNpcError] =
    useState<string | null>(null);
  const [
    popularDocuments,
    setPopularDocuments,
  ] = useState<HomePopularDocument[]>([]);
  const [
    popularDocumentsLoading,
    setPopularDocumentsLoading,
  ] = useState(true);
  const [
    faqRanking,
    setFaqRanking,
  ] = useState<HomeFaqRankItem[]>([]);
  const [
    faqRankingLoading,
    setFaqRankingLoading,
  ] = useState(true);
  const [
    selectedFaq,
    setSelectedFaq,
  ] = useState<FaqItem | null>(null);
  const [
    loadingFaq,
    setLoadingFaq,
  ] = useState(false);
  const [
    faqError,
    setFaqError,
  ] = useState<string | null>(null);
  const [
    popularSearches,
    setPopularSearches,
  ] = useState<
    HomePopularSearchItem[]
  >([]);
  const [
    popularSearchesLoading,
    setPopularSearchesLoading,
  ] = useState(true);

  /*
   * 인기 문서는 Home 서버 렌더링과 분리한다.
   * 조회가 느리거나 실패해도 / 페이지 자체는 정상 표시된다.
   */
  useEffect(() => {
    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(() => {
        controller.abort();
      }, 8000);

    void fetch('/api/home/popular', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `popular-fetch-failed:${response.status}`
          );
        }

        return (await response.json()) as
          PopularDocumentsResponse;
      })
      .then((payload) => {
        setPopularDocuments(
          Array.isArray(payload.items)
            ? payload.items
            : []
        );
      })
      .catch((error) => {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }

        console.error(
          '[HomePage] 인기 문서 조회 실패:',
          error
        );
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setPopularDocumentsLoading(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  /*
   * FAQ 순위도 Home 서버 렌더링과 분리한다.
   * FAQ 조회가 실패해도 Home 전체 화면은 정상 표시된다.
   */
  useEffect(() => {
    const controller =
      new AbortController();
    let active = true;

    const timeoutId =
      window.setTimeout(() => {
        controller.abort();
      }, 8000);

    void fetch('/api/home/faqs?range=week&limit=5', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `faq-ranking-fetch-failed:${response.status}`
          );
        }

        return (await response.json()) as
          HomeFaqRankingResponse;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        setFaqRanking(
          Array.isArray(payload.items)
            ? payload.items
            : []
        );
      })
      .catch((error) => {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }

        console.error(
          '[HomePage] FAQ 순위 조회 실패:',
          error
        );
      })
      .finally(() => {
        window.clearTimeout(timeoutId);

        if (active) {
          setFaqRankingLoading(false);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  /*
   * 인기 검색어는 검색 결과가 실제로 선택된 횟수를 기준으로 한다.
   * 단순 입력이나 실시간 검색 API 호출만으로는 증가하지 않는다.
   */
  useEffect(() => {
    const controller =
      new AbortController();
    let active = true;

    const timeoutId =
      window.setTimeout(() => {
        controller.abort();
      }, 8000);

    void fetch(
      '/api/home/search-keywords?range=week&limit=6',
      {
        cache: 'no-store',
        signal:
          controller.signal,
      }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `popular-search-fetch-failed:${response.status}`
          );
        }

        return (
          await response.json()
        ) as HomePopularSearchResponse;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        setPopularSearches(
          Array.isArray(
            payload.items
          )
            ? payload.items
            : []
        );
      })
      .catch((error) => {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return;
        }

        console.error(
          '[HomePage] 인기 검색어 조회 실패:',
          error
        );
      })
      .finally(() => {
        window.clearTimeout(
          timeoutId
        );

        if (active) {
          setPopularSearchesLoading(
            false
          );
        }
      });

    return () => {
      active = false;
      window.clearTimeout(
        timeoutId
      );
      controller.abort();
    };
  }, []);

  const openFaq = useCallback(
    async (faqId: number) => {
      setLoadingFaq(true);
      setFaqError(null);

      try {
        /*
         * 상세 내용 조회와 조회수 기록을 분리한다.
         * Home 순위에서 실제 질문을 연 경우 source=home으로 기록한다.
         */
        const response = await fetch(
          `/api/faq/${encodeURIComponent(faqId)}`,
          {
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error(
            `faq-fetch-failed:${response.status}`
          );
        }

        const payload =
          (await response.json()) as FaqItem;

        if (
          !Number.isInteger(Number(payload?.id)) ||
          Number(payload.id) <= 0
        ) {
          throw new Error(
            'invalid-faq-payload'
          );
        }

        setSelectedFaq(payload);
        void recordFaqView(
          faqId,
          'home'
        );
      } catch (error) {
        console.error(
          '[HomePage] FAQ 상세 조회 실패:',
          error
        );
        setFaqError(
          '질문 내용을 불러오지 못했습니다.'
        );
      } finally {
        setLoadingFaq(false);
      }
    },
    []
  );

  const openQuestNpc = useCallback(
    async (npcId: number) => {
      setLoadingQuestNpc(true);
      setQuestNpcError(null);

      try {
        const response = await fetch(
          `/api/npcs/${encodeURIComponent(npcId)}`,
          {
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error(
            `npc-fetch-failed:${response.status}`
          );
        }

        const payload = await response.json();
        const normalizedNpc = normalizeNpcPayload(payload);

        if (
          !Number.isFinite(normalizedNpc.id) ||
          normalizedNpc.id <= 0
        ) {
          throw new Error('invalid-npc-payload');
        }

        setSelectedQuestNpc(normalizedNpc);
      } catch (error) {
        console.error(
          '[HomePage] 퀘스트 NPC 상세 조회 실패:',
          error
        );
        setQuestNpcError(
          'NPC 정보를 불러오지 못했습니다.'
        );
      } finally {
        setLoadingQuestNpc(false);
      }
    },
    []
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="RDWIKI 홈"
          >
            <Image
              src={logo}
              alt=""
              width={46}
              height={46}
              className={styles.brandImage}
              priority
            />

            <span className={styles.brandTextGroup}>
              <strong className={styles.brandTitle}>
                RDWIKI
              </strong>

              <span className={styles.brandSubtitle}>
                REN DOG WIKI
              </span>
            </span>
          </Link>

          <nav
            className={styles.headerNav}
            aria-label="주요 메뉴"
          >
            <Link
              href={getCategoryHref('content')}
              className={styles.headerNavLink}
            >
              컨텐츠
            </Link>

            <Link
              href={getCategoryHref('system')}
              className={styles.headerNavLink}
            >
              시스템
            </Link>

            <Link
              href={getCategoryHref('price')}
              className={styles.headerNavLink}
            >
              시세표
            </Link>

            <Link
              href="/wiki"
              className={styles.headerNavLink}
            >
              후원
            </Link>

            <Link
              href={getCategoryHref('policy')}
              className={`${styles.headerNavLink} ${styles.headerNavPrimary}`}
            >
              법전
            </Link>
          </nav>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.layout}>
          <aside
            className={styles.leftRail}
            aria-hidden="true"
          >
            <div className={styles.leftTree} />
            <div className={styles.leftGrass} />
          </aside>

          <main className={styles.main}>
            <section
              className={styles.hero}
              style={{
                overflow: 'visible',
                zIndex: 20,
              }}
            >
              <div
                className={styles.heroLandscape}
                aria-hidden="true"
              >
                <span
                  className={styles.heroTreeLeft}
                />
                <span
                  className={styles.heroTreeRight}
                />
                <span
                  className={styles.heroHillLeft}
                />
                <span
                  className={styles.heroHillRight}
                />
              </div>

              <div className={styles.heroContent}>
                <p className={styles.heroEyebrow}>
                  마인크래프트 렌독 서버 비공식 위키
                </p>

                <h1 className={styles.heroTitle}>
                  렌독위키
                </h1>

                <p className={styles.heroDescription}>
                  원하는 정보를 빠르고 편하게 찾아보세요.
                </p>

                <div
                  style={{
                    position: 'relative',
                    zIndex: 30,
                    width: '100%',
                    marginTop: 18,
                    textAlign: 'left',
                  }}
                >
                  <SearchBox
                    align="left"
                    width="100%"
                    paddingLeft={0}
                    resultModalOpen={
                      loadingQuestNpc ||
                      selectedQuestNpc !== null ||
                      loadingFaq ||
                      selectedFaq !== null
                    }
                    onQuestNpcClick={(npcId) => {
                      void openQuestNpc(npcId);
                    }}
                  />

                  {loadingQuestNpc && (
                    <span
                      role="status"
                      aria-live="polite"
                      style={{
                        display: 'block',
                        marginTop: 7,
                        paddingLeft: 12,
                        color: '#4d7356',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      NPC 정보를 불러오는 중입니다.
                    </span>
                  )}
                </div>

                <div className={styles.keywordRow}>
                  <strong>인기 검색어</strong>

                  {popularSearchesLoading ? (
                    <span
                      style={{
                        color:
                          '#56715b',
                      }}
                    >
                      집계 중
                    </span>
                  ) : popularSearches.length >
                    0 ? (
                    popularSearches.map(
                      (item) => (
                        <a
                          key={
                            item.keyword
                          }
                          href="#home-search"
                          title={`최근 7일 검색 ${item.searches}회`}
                          onClick={(
                            event
                          ) => {
                            event.preventDefault();

                            requestSearchQuery(
                              item.keyword
                            );
                          }}
                        >
                          {item.keyword}
                        </a>
                      )
                    )
                  ) : (
                    <span
                      style={{
                        color:
                          '#56715b',
                      }}
                    >
                      집계된 검색어가 없습니다.
                    </span>
                  )}
                </div>
              </div>

              <Image
                src={logo}
                alt=""
                width={164}
                height={164}
                className={styles.heroMascot}
                aria-hidden="true"
              />
            </section>

            <section className={styles.newcomer}>
              <div
                className={styles.newcomerCharacter}
                aria-hidden="true"
              >

              </div>

              <div className={styles.newcomerContent}>
                <p className={styles.sectionEyebrow}>
                  WELCOME TO RDWIKI
                </p>

                <h2>처음 오셨나요?</h2>

                <p>
                  렌독 서버가 처음이라면 뉴비
                  가이드에서 기본적인 성장 과정과 위키
                  사용 방법을 확인해 보세요.
                </p>

                <div className={styles.newcomerTags}>
                  <Link
                    href="/wiki?mode=RPG&path=32&title=%EC%84%9C%EB%B2%84%EC%97%90_%EC%B2%98%EC%9D%8C_%EB%93%A4%EC%96%B4%EC%99%94%EC%96%B4%EC%9A%94&id=323"
                  >
                    위키 사용법
                  </Link>

                  <Link
                    href="/wiki?mode=RPG&path=32&title=1%EC%B0%A8_%EC%A0%84%EC%A7%81_%EC%A4%91_%ED%95%84%EC%9A%94%ED%95%9C_%ED%8C%81&id=334"
                  >
                    1차 전직 가이드
                  </Link>

                  <Link
                    href="/wiki?mode=RPG&path=32&title=2%EC%B0%A8_%EC%A0%84%EC%A7%81_%EA%B0%80%EC%9D%B4%EB%93%9C&id=325"
                  >
                    2차 전직 가이드
                  </Link>

                  <Link
                    href="/wiki?mode=RPG&path=32&title=%EC%84%9C%EB%B2%84%EC%9D%98_%EC%9A%A9%EC%96%B4%EB%A5%BC_%EC%95%8C%EA%B3%A0%EC%8B%B6%EC%96%B4%EC%9A%94&id=324"
                  >
                    서버 용어
                  </Link>
                </div>
              </div>

              <Link
                href="/wiki?mode=RPG&path=32&title=%EC%84%9C%EB%B2%84%EC%97%90_%EC%B2%98%EC%9D%8C_%EB%93%A4%EC%96%B4%EC%99%94%EC%96%B4%EC%9A%94&id=323"
                className={styles.outlineButton}
              >
                뉴비 가이드 보기
                <span aria-hidden="true">›</span>
              </Link>
            </section>

            <section
              className={styles.categoryGrid}
              aria-label="대표 카테고리"
            >
              {categoryCards.map((category) => (
                <Link
                  key={category.title}
                  href={getCategoryHref(category.key)}
                  className={`${styles.categoryCard} ${
                    styles[
                      `categoryCard_${category.tone}`
                    ]
                  }`}
                >
                  <span
                    className={styles.categoryIcon}
                    aria-hidden="true"
                  >
                    {category.icon}
                  </span>

                  <span className={styles.categoryBody}>
                    <strong>{category.title}</strong>
                    <span>
                      {category.description}
                    </span>
                  </span>

                  <span
                    className={styles.categoryArrow}
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </Link>
              ))}
            </section>

            <section
              className={styles.informationGrid}
            >
              <article
                className={styles.informationCard}
              >
                <div className={styles.cardHeading}>
                  <h2>
                    <span aria-hidden="true">❓</span>
                    자주 묻는 질문
                  </h2>

                  <Link href={FAQ_DOCUMENT_HREF}>
                    더보기 ›
                  </Link>
                </div>

                <ol className={styles.popularList}>
                  {faqRankingLoading ? (
                    <li
                      className={
                        styles.emptyDocument
                      }
                    >
                      질문 순위를 불러오는 중입니다.
                    </li>
                  ) : faqRanking.length > 0 ? (
                    faqRanking.map(
                      (faq, index) => (
                        <li key={faq.id}>
                          <Link
                            href={FAQ_DOCUMENT_HREF}
                            aria-label={`${index + 1}위 ${
                              faq.title
                            }, 누적 열람 ${
                              faq.views
                            }회`}
                            onClick={(event) => {
                              event.preventDefault();
                              void openFaq(faq.id);
                            }}
                          >
                            <span
                              className={
                                styles.popularRank
                              }
                            >
                              {index + 1}
                            </span>

                            <span>{faq.title}</span>
                          </Link>
                        </li>
                      )
                    )
                  ) : (
                    <li
                      className={
                        styles.emptyDocument
                      }
                    >
                      등록된 질문이 없습니다.
                    </li>
                  )}
                </ol>
              </article>

              <article
                className={styles.informationCard}
              >
                <div className={styles.cardHeading}>
                  <h2>
                    <span aria-hidden="true">📚</span>
                    최근 업데이트된 문서
                  </h2>

                  <Link href="/wiki">
                    더보기 ›
                  </Link>
                </div>

                <ul className={styles.documentList}>
                  {recentDocuments.length > 0 ? (
                    recentDocuments.map((document) => (
                      <li key={document.id}>
                        <Link href={document.href}>
                          <span
                            className={
                              styles.documentType
                            }
                          >
                            {document.category}
                          </span>

                          <span
                            className={
                              styles.documentTitle
                            }
                          >
                            {document.title}
                          </span>

                          <time
                            dateTime={
                              document.updatedAt
                            }
                          >
                            {document.updatedLabel}
                          </time>
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li
                      className={
                        styles.emptyDocument
                      }
                    >
                      최근 업데이트된 문서를
                      불러오지 못했습니다.
                    </li>
                  )}
                </ul>
              </article>

              <article
                className={styles.informationCard}
              >
                <div className={styles.cardHeading}>
                  <h2>
                    <span aria-hidden="true">⭐</span>
                    인기 문서
                  </h2>

                  <Link href="/wiki">
                    더보기 ›
                  </Link>
                </div>

                <ol className={styles.popularList}>
                  {popularDocumentsLoading ? (
                    <li
                      className={
                        styles.emptyDocument
                      }
                    >
                      인기 문서를 불러오는 중입니다.
                    </li>
                  ) : popularDocuments.length > 0 ? (
                    popularDocuments.map(
                      (document, index) => (
                        <li key={document.id}>
                          <Link
                            href={document.href}
                            aria-label={`${index + 1}위 ${
                              document.title
                            }, 최근 7일 조회수 ${
                              document.views
                            }회`}
                          >
                            <span
                              className={
                                styles.popularRank
                              }
                            >
                              {index + 1}
                            </span>

                            <span>
                              {document.title}
                            </span>
                          </Link>
                        </li>
                      )
                    )
                  ) : (
                    <li
                      className={
                        styles.emptyDocument
                      }
                    >
                      최근 7일간 집계된 인기 문서가
                      없습니다.
                    </li>
                  )}
                </ol>
              </article>
            </section>

            <section
              className={styles.recommendSection}
            >
              <div className={styles.sectionHeading}>
                <div>
                  <p
                    className={
                      styles.sectionEyebrow
                    }
                  >
                    RECOMMENDED
                  </p>

                  <h2>추천 탐색</h2>
                </div>

                <Link href="/wiki">
                  전체 문서 보기 ›
                </Link>
              </div>

              <div className={styles.recommendGrid}>
                {recommendations.map(
                  (recommendation) => (
                    <Link
                      key={recommendation.title}
                      href="/wiki"
                      className={
                        styles.recommendCard
                      }
                    >
                      <span
                        className={
                          styles.recommendIcon
                        }
                        aria-hidden="true"
                      >
                        {recommendation.icon}
                      </span>

                      <span
                        className={
                          styles.recommendBody
                        }
                      >
                        <small>
                          {recommendation.label}
                        </small>
                        <strong>
                          {recommendation.title}
                        </strong>
                        <span>
                          {
                            recommendation.description
                          }
                        </span>
                      </span>

                      <span
                        className={
                          styles.recommendArrow
                        }
                        aria-hidden="true"
                      >
                        ›
                      </span>
                    </Link>
                  )
                )}
              </div>
            </section>

            <footer className={styles.footer}>
              <div className={styles.footerBrand}>
                <Image
                  src={logo}
                  alt=""
                  width={34}
                  height={34}
                />

                <div>
                  <strong>RDWIKI</strong>
                  <span>
                    렌독 유저를 위한 비공식 정보
                    위키
                  </span>
                </div>
              </div>

              <div className={styles.footerLinks}>
                <Link href="/wiki">
                  운영 원칙
                </Link>
                <Link href="/wiki">
                  문의하기
                </Link>
                <Link href="/wiki">
                  후원하기
                </Link>
              </div>
            </footer>
          </main>

          <aside
            className={styles.rightRail}
            aria-hidden="true"
          >
            <div className={styles.rightTower} />
            <div className={styles.rightGrass} />
          </aside>
        </div>
      </div>

      {selectedFaq && (
        <FaqDetailModal
          sel={selectedFaq}
          onClose={() => {
            setSelectedFaq(null);
          }}
        />
      )}

      {loadingFaq && (
        <span
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            zIndex: 12000,
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 10,
            background:
              'var(--surface-elevated)',
            boxShadow: 'var(--shadow-xl)',
            color: 'var(--foreground)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          질문 내용을 불러오는 중입니다.
        </span>
      )}

      {selectedQuestNpc && (
        <NpcDetailModal
          npc={selectedQuestNpc}
          mode="quest"
          onClose={() => {
            setSelectedQuestNpc(null);
          }}
        />
      )}

      {faqError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            zIndex: 12000,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 360,
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 12,
            background:
              'var(--surface-elevated)',
            boxShadow: 'var(--shadow-xl)',
            color: 'var(--foreground)',
            fontSize: 13,
          }}
        >
          <span>{faqError}</span>

          <button
            type="button"
            aria-label="FAQ 오류 알림 닫기"
            onClick={() => {
              setFaqError(null);
            }}
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 26,
              height: 26,
              border: 0,
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--danger-fg)',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}

      {questNpcError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            zIndex: 12000,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 360,
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 12,
            background:
              'var(--surface-elevated)',
            boxShadow: 'var(--shadow-xl)',
            color: 'var(--foreground)',
            fontSize: 13,
          }}
        >
          <span>{questNpcError}</span>

          <button
            type="button"
            aria-label="오류 알림 닫기"
            onClick={() => {
              setQuestNpcError(null);
            }}
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 26,
              height: 26,
              border: 0,
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--danger-fg)',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
