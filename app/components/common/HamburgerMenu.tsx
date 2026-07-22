// =============================================
// File: app/components/common/HamburgerMenu.tsx
// 전체 코드
//
// - 홈 페이지와 같은 크림·민트·초록 계열 디자인
// - 기존 관리 메뉴 경로와 로그인/로그아웃 동작 유지
// - 기존 메뉴 로고를 홈 RDWIKI 로고로 교체
// - portal 렌더링으로 헤더와 독립된 전체 화면 백드롭 유지
// - ESC, 백드롭 클릭, 닫기 버튼 지원
// - 다크 모드 및 모바일 대응
// =============================================

'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  createPortal,
} from 'react-dom';

import styles from '@/wiki/css/hamburgerMenu.module.css';

type HamburgerMenuProps = {
  isOpen?: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  username?: string;
  uuid?: string;
  onLogout: () => void | Promise<void>;
};

type MenuItem = {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone:
    | 'green'
    | 'mint'
    | 'blue'
    | 'orange'
    | 'lime';
};

const menuItems: ReadonlyArray<MenuItem> = [
  {
    href: '/manage/image',
    title: '이미지 관리',
    description:
      '이미지와 폴더를 정리합니다.',
    tone: 'green',
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v12.5A1.75 1.75 0 0 1 18.25 20H5.75A1.75 1.75 0 0 1 4 18.25V5.75Z" />
        <path d="m6.8 17 3.2-3.4 2.45 2.35 1.85-1.8L17.3 17H6.8Z" />
        <circle
          cx="8.4"
          cy="8.4"
          r="1.35"
        />
      </svg>
    ),
  },
  {
    href: '/manage/category',
    title: '카테고리 관리',
    description:
      '문서 분류와 순서를 관리합니다.',
    tone: 'mint',
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M4.5 6.5h6v5h-6zM13.5 6.5h6v5h-6zM4.5 14h6v4h-6zM13.5 14h6v4h-6z" />
      </svg>
    ),
  },
  {
    href: '/manage/npc',
    title: 'NPC 관리',
    description:
      'NPC 정보와 대사를 편집합니다.',
    tone: 'blue',
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="8"
          r="3.25"
        />
        <path d="M5.75 19.25c.55-3.35 2.65-5.15 6.25-5.15s5.7 1.8 6.25 5.15" />
      </svg>
    ),
  },
  {
    href: '/manage/quest',
    title: '퀘스트 관리',
    description:
      '퀘스트와 보상 정보를 관리합니다.',
    tone: 'orange',
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M7 4.5h10v15H7z" />
        <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
      </svg>
    ),
  },
  {
    href: '/manage/head',
    title: '머리 관리',
    description:
      '머리 위치와 이미지를 관리합니다.',
    tone: 'lime',
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="m12 3.8 7 4v8.4l-7 4-7-4V7.8l7-4Z" />
        <path d="m5 7.8 7 4 7-4M12 11.8v8.4" />
      </svg>
    ),
  },
];

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M13 5h5v14h-5M10 8l4 4-4 4M14 12H4" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="9"
        cy="8"
        r="3"
      />
      <path d="M3.5 19c.5-3.2 2.35-4.8 5.5-4.8 2.2 0 3.75.8 4.7 2.4M18 8v6M15 11h6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="3.25"
      />
      <path d="M5.75 19.25c.55-3.35 2.65-5.15 6.25-5.15s5.7 1.8 6.25 5.15" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M11 5H6v14h5M14 8l4 4-4 4M18 12H9" />
    </svg>
  );
}

export default function HamburgerMenu({
  isOpen = true,
  onClose,
  isLoggedIn,
  username = '',
  uuid,
  onLogout,
}: HamburgerMenuProps) {
  const [
    mounted,
    setMounted,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const displayName =
    username.trim() || 'RDWIKI 사용자';

  const initial = useMemo(() => {
    const value =
      displayName.trim();

    return (
      value.charAt(0).toUpperCase() ||
      'R'
    );
  }, [displayName]);

  /*
   * 현재 메뉴에서는 외부 스킨 이미지를 사용하지 않는다.
   * uuid prop은 기존 호출부 호환성을 위해 유지한다.
   */
  void uuid;

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;
    const previousPaddingRight =
      document.body.style.paddingRight;

    const scrollbarWidth =
      window.innerWidth -
      document.documentElement.clientWidth;

    document.body.style.overflow =
      'hidden';

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight =
        `${scrollbarWidth}px`;
    }

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;
      document.body.style.paddingRight =
        previousPaddingRight;

      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
    };
  }, [
    isOpen,
    onClose,
  ]);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  if (
    !mounted ||
    !isOpen
  ) {
    return null;
  }

  return createPortal(
    <div
      className={styles.layer}
      role="presentation"
    >
      <button
        type="button"
        className={styles.backdrop}
        aria-label="관리 메뉴 닫기"
        onClick={onClose}
      />

      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rdwiki-menu-title"
      >
        <div
          className={styles.ambient}
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

        <header className={styles.header}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="RDWIKI 홈"
            onClick={onClose}
          >
            <Image
              src="/images/home/branding/rdwiki-logo.png"
              alt="RDWIKI"
              width={360}
              height={120}
              className={styles.logo}
              priority
            />
          </Link>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="관리 메뉴 닫기"
          >
            <CloseIcon />
          </button>
        </header>

        <div className={styles.scrollArea}>
          <section
            className={styles.welcomeCard}
            aria-label={
              isLoggedIn
                ? '로그인 사용자 정보'
                : '비로그인 사용자 안내'
            }
          >
            <div
              className={styles.avatar}
              aria-hidden="true"
            >
              {isLoggedIn ? (
                <span>{initial}</span>
              ) : (
                <UserIcon />
              )}
            </div>

            <div className={styles.welcomeBody}>
              <p className={styles.eyebrow}>
                {isLoggedIn
                  ? 'WELCOME BACK'
                  : 'WELCOME TO RDWIKI'}
              </p>

              <h2 id="rdwiki-menu-title">
                {isLoggedIn
                  ? `${displayName}님`
                  : '게스트로 둘러보는 중'}
              </h2>

              <p>
                {isLoggedIn
                  ? '렌독위키 관리 도구와 개인 메뉴를 이용할 수 있습니다.'
                  : '로그인하면 문서와 관리 기능을 더욱 편하게 이용할 수 있습니다.'}
              </p>
            </div>
          </section>

          <section
            className={styles.menuSection}
            aria-labelledby="manage-menu-heading"
          >
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>
                  RDWIKI TOOLS
                </p>

                <h3 id="manage-menu-heading">
                  관리 메뉴
                </h3>
              </div>

              <span>
                {menuItems.length}
              </span>
            </div>

            <nav
              className={styles.menuList}
              aria-label="관리 도구"
            >
              {menuItems.map(
                (item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={styles.menuItem}
                    data-tone={item.tone}
                    onClick={onClose}
                  >
                    <span
                      className={styles.menuIcon}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>

                    <span className={styles.menuText}>
                      <strong>
                        {item.title}
                      </strong>

                      <span>
                        {item.description}
                      </span>
                    </span>

                    <span
                      className={styles.menuArrow}
                      aria-hidden="true"
                    >
                      <ArrowIcon />
                    </span>
                  </Link>
                ),
              )}
            </nav>
          </section>
        </div>

        <footer className={styles.footer}>
          {isLoggedIn ? (
            <>
              <Link
                href="/mypage"
                className={`${styles.accountButton} ${styles.accountButtonPrimary}`}
                onClick={onClose}
              >
                <UserIcon />
                <span>마이페이지</span>
              </Link>

              <button
                type="button"
                className={`${styles.accountButton} ${styles.accountButtonSecondary}`}
                onClick={() => {
                  void handleLogout();
                }}
                disabled={loggingOut}
              >
                <LogoutIcon />
                <span>
                  {loggingOut
                    ? '로그아웃 중'
                    : '로그아웃'}
                </span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`${styles.accountButton} ${styles.accountButtonPrimary}`}
                onClick={onClose}
              >
                <LoginIcon />
                <span>로그인</span>
              </Link>

              <Link
                href="/register"
                className={`${styles.accountButton} ${styles.accountButtonSecondary}`}
                onClick={onClose}
              >
                <UserPlusIcon />
                <span>회원가입</span>
              </Link>
            </>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
