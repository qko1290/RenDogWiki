// =============================================
// File: app/components/home/HomePage.tsx
// (전체 코드)
// - 문서 화면과 동일한 3열 폭 유지
// - 좌우 영역은 비상호작용 장식으로만 사용
// - Home 중앙 콘텐츠만 문서 영역에 배치
// - 데이터 및 검색 기능은 다음 단계에서 연결
// =============================================

import Image from 'next/image';
import Link from 'next/link';

import logo from '@/image/logo.png';

import styles from './home.module.css';

import type { HomeRecentDocument } from './homeData';

const categoryCards = [
  {
    title: '콘텐츠',
    description: '던전, 퀘스트, 이벤트와 생활 콘텐츠 정보를 확인하세요.',
    icon: '🎮',
    tone: 'green',
  },
  {
    title: '시스템',
    description: '성장, 강화, 거래 등 서버의 주요 시스템을 알아보세요.',
    icon: '⚙️',
    tone: 'mint',
  },
  {
    title: '시세표',
    description: '아이템 시세와 거래에 필요한 정보를 빠르게 확인하세요.',
    icon: '💎',
    tone: 'blue',
  },
  {
    title: '운영 원칙',
    description: '서버 운영 규칙과 이용 정책을 확인할 수 있습니다.',
    icon: '⚖️',
    tone: 'orange',
  },
] as const;

const notices = [
  '서버 이용 전 운영 원칙을 확인해 주세요.',
  '문서 정보 오류 제보 안내',
  '위키 개선 작업 진행 안내',
  '신규 콘텐츠 문서 작성 안내',
] as const;

const popularDocuments = [
  '돈 버는 방법 총정리',
  '경험치 효율 사냥터',
  '보스 공략 모음',
  '초보자 추천 장비',
  '생활 콘텐츠 가이드',
] as const;

const recommendations = [
  {
    label: '처음 시작한다면',
    title: '뉴비 스타트 가이드',
    description: '첫 접속부터 기본 장비 준비까지 순서대로 살펴보세요.',
    icon: '🌱',
  },
  {
    label: '오늘 무엇을 할지 고민된다면',
    title: '추천 콘텐츠 둘러보기',
    description: '현재 성장 단계에 맞는 콘텐츠를 확인해 보세요.',
    icon: '🧭',
  },
  {
    label: '성장이 막혔다면',
    title: '장비와 재화 가이드',
    description: '강화, 거래, 재화 수급 관련 문서를 모아봤습니다.',
    icon: '🛠️',
  },
] as const;

type HomePageProps = {
  recentDocuments: HomeRecentDocument[];
};

export default function HomePage({
  recentDocuments,
}: HomePageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="RDWIKI 홈">
            <Image
              src={logo}
              alt=""
              width={46}
              height={46}
              className={styles.brandImage}
              priority
            />

            <span className={styles.brandTextGroup}>
              <strong className={styles.brandTitle}>RDWIKI</strong>
              <span className={styles.brandSubtitle}>
                REN DOG WIKI
              </span>
            </span>
          </Link>

          <nav className={styles.headerNav} aria-label="주요 메뉴">
            <Link href="/wiki" className={styles.headerNavLink}>
              콘텐츠
            </Link>

            <Link href="/wiki" className={styles.headerNavLink}>
              시스템
            </Link>

            <Link href="/wiki" className={styles.headerNavLink}>
              시세표
            </Link>

            <Link href="/wiki" className={styles.headerNavLink}>
              후원
            </Link>

            <Link
              href="/wiki"
              className={`${styles.headerNavLink} ${styles.headerNavPrimary}`}
            >
              운영 원칙
            </Link>
          </nav>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.layout}>
          <aside className={styles.leftRail} aria-hidden="true">
            <div className={styles.leftTree} />
            <div className={styles.leftGrass} />
          </aside>

          <main className={styles.main}>
            <section className={styles.hero}>
              <div className={styles.heroLandscape} aria-hidden="true">
                <span className={styles.heroTreeLeft} />
                <span className={styles.heroTreeRight} />
                <span className={styles.heroHillLeft} />
                <span className={styles.heroHillRight} />
              </div>

              <div className={styles.heroContent}>
                <p className={styles.heroEyebrow}>
                  마인크래프트 렌독 서버 비공식 위키
                </p>

                <h1 className={styles.heroTitle}>렌독위키</h1>

                <p className={styles.heroDescription}>
                  원하는 정보를 빠르고 편하게 찾아보세요.
                </p>

                <form
                  action="/wiki"
                  method="get"
                  className={styles.searchForm}
                >
                  <span className={styles.searchIcon} aria-hidden="true">
                    ⌕
                  </span>

                  <input
                    name="homeSearch"
                    type="search"
                    className={styles.searchInput}
                    placeholder="검색어를 입력하세요. 예: 의뢰, 강화, 보스"
                    aria-label="위키 검색어"
                  />

                  <button
                    type="submit"
                    className={styles.searchButton}
                    aria-label="검색"
                  >
                    검색
                  </button>
                </form>

                <div className={styles.keywordRow}>
                  <strong>인기 검색어</strong>

                  <Link href="/wiki">초보자 가이드</Link>
                  <Link href="/wiki">돈 버는 방법</Link>
                  <Link href="/wiki">강화</Link>
                  <Link href="/wiki">던전</Link>
                  <Link href="/wiki">무기</Link>
                  <Link href="/wiki">보스</Link>
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
              <div className={styles.newcomerCharacter} aria-hidden="true">
                🌿
              </div>

              <div className={styles.newcomerContent}>
                <p className={styles.sectionEyebrow}>
                  WELCOME TO RDWIKI
                </p>

                <h2>처음 오셨나요?</h2>

                <p>
                  렌독 서버가 처음이라면 뉴비 가이드에서 기본적인
                  성장 과정과 위키 사용 방법을 확인해 보세요.
                </p>

                <div className={styles.newcomerTags}>
                  <span>시작 가이드</span>
                  <span>추천 직업</span>
                  <span>초반 성장</span>
                  <span>필수 팁</span>
                </div>
              </div>

              <Link href="/wiki" className={styles.outlineButton}>
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
                  href="/wiki"
                  className={`${styles.categoryCard} ${
                    styles[`categoryCard_${category.tone}`]
                  }`}
                >
                  <span className={styles.categoryIcon} aria-hidden="true">
                    {category.icon}
                  </span>

                  <span className={styles.categoryBody}>
                    <strong>{category.title}</strong>
                    <span>{category.description}</span>
                  </span>

                  <span className={styles.categoryArrow} aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
            </section>

            <section className={styles.informationGrid}>
              <article className={styles.informationCard}>
                <div className={styles.cardHeading}>
                  <h2>
                    <span aria-hidden="true">📢</span>
                    공지사항
                  </h2>

                  <Link href="/wiki">더보기 ›</Link>
                </div>

                <ul className={styles.noticeList}>
                  {notices.map((notice, index) => (
                    <li key={notice}>
                      <Link href="/wiki">
                        <span>{notice}</span>
                        <time>{`0${index + 1}.15`}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>

              <article className={styles.informationCard}>
                <div className={styles.cardHeading}>
                  <h2>
                    <span aria-hidden="true">📚</span>
                    최근 업데이트된 문서
                  </h2>

                  <Link href="/wiki">더보기 ›</Link>
                </div>

                <ul className={styles.documentList}>
                  {recentDocuments.length > 0 ? (
                    recentDocuments.map((document) => (
                      <li key={document.id}>
                        <Link href={document.href}>
                          <span className={styles.documentType}>
                            {document.category}
                          </span>

                          <span className={styles.documentTitle}>
                            {document.title}
                          </span>

                          <time dateTime={document.updatedAt}>
                            {document.updatedLabel}
                          </time>
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li className={styles.emptyDocument}>
                      최근 업데이트된 문서를 불러오지 못했습니다.
                    </li>
                  )}
                </ul>
              </article>

              <article className={styles.informationCard}>
                <div className={styles.cardHeading}>
                  <h2>
                    <span aria-hidden="true">⭐</span>
                    인기 문서
                  </h2>

                  <Link href="/wiki">더보기 ›</Link>
                </div>

                <ol className={styles.popularList}>
                  {popularDocuments.map((document, index) => (
                    <li key={document}>
                      <Link href="/wiki">
                        <span className={styles.popularRank}>
                          {index + 1}
                        </span>

                        <span>{document}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </article>
            </section>

            <section className={styles.recommendSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionEyebrow}>
                    RECOMMENDED
                  </p>

                  <h2>추천 탐색</h2>
                </div>

                <Link href="/wiki">전체 문서 보기 ›</Link>
              </div>

              <div className={styles.recommendGrid}>
                {recommendations.map((recommendation) => (
                  <Link
                    key={recommendation.title}
                    href="/wiki"
                    className={styles.recommendCard}
                  >
                    <span className={styles.recommendIcon} aria-hidden="true">
                      {recommendation.icon}
                    </span>

                    <span className={styles.recommendBody}>
                      <small>{recommendation.label}</small>
                      <strong>{recommendation.title}</strong>
                      <span>{recommendation.description}</span>
                    </span>

                    <span className={styles.recommendArrow} aria-hidden="true">
                      ›
                    </span>
                  </Link>
                ))}
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
                  <span>렌독 유저를 위한 비공식 정보 위키</span>
                </div>
              </div>

              <div className={styles.footerLinks}>
                <Link href="/wiki">운영 원칙</Link>
                <Link href="/wiki">문의하기</Link>
                <Link href="/wiki">후원하기</Link>
              </div>
            </footer>
          </main>

          <aside className={styles.rightRail} aria-hidden="true">
            <div className={styles.rightTower} />
            <div className={styles.rightGrass} />
          </aside>
        </div>
      </div>
    </div>
  );
}