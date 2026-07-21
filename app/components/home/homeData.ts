// =============================================
// File: app/components/home/homeData.ts
// (전체 코드)
// - Home 페이지 전용 서버 데이터 조회
// - 최근 업데이트된 문서 조회
// - DB 오류 발생 시 빈 배열 반환
// =============================================

import 'server-only';

import { cached } from '@/wiki/lib/cache';
import { runDbRead, sql } from '@/wiki/lib/db';

export type HomeRecentDocument = {
  id: number;
  title: string;
  category: string;
  href: string;
  updatedAt: string;
  updatedLabel: string;
};

type RecentDocumentRow = {
  id: number | string;
  title: string;
  path: string | number | null;
  updated_at: string | Date | null;
  category_name: string | null;
};

const homeDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
});

function normalizeDate(value: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDateLabel(date: Date) {
  const parts = homeDateFormatter.formatToParts(date);

  const month =
    parts.find((part) => part.type === 'month')?.value ?? '--';

  const day =
    parts.find((part) => part.type === 'day')?.value ?? '--';

  return `${month}.${day}`;
}

function createWikiDocumentHref(
  id: number,
  path: string | number | null,
  title: string
) {
  const searchParams = new URLSearchParams({
    id: String(id),
    path: String(path ?? 0),
    title,
  });

  return `/wiki?${searchParams.toString()}`;
}

export async function getRecentHomeDocuments(
  requestedLimit = 4
): Promise<HomeRecentDocument[]> {
  const limit = Math.min(
    Math.max(Math.trunc(requestedLimit), 1),
    10
  );

  try {
    return await cached(
      `home:recent-documents:${limit}`,
      {
        ttlSec: 60,
        tags: ['doc:list'],
      },
      async () => {
        const rows = (await runDbRead(
          'home:recent-documents',
          async () => {
            return await sql`
              SELECT
                d.id,
                d.title,
                d.path,
                d.updated_at,
                COALESCE(c.name, '문서') AS category_name
              FROM documents d
              LEFT JOIN categories c
                ON c.id::text = d.path::text
              WHERE d.updated_at IS NOT NULL
              ORDER BY
                d.updated_at DESC,
                d.id DESC
              LIMIT ${limit}
            `;
          }
        )) as unknown as RecentDocumentRow[];

        return rows
          .map((row): HomeRecentDocument | null => {
            const id = Number(row.id);
            const updatedDate = normalizeDate(row.updated_at);

            if (
              !Number.isFinite(id) ||
              id <= 0 ||
              !row.title ||
              !updatedDate
            ) {
              return null;
            }

            return {
              id,
              title: row.title,
              category: row.category_name || '문서',
              href: createWikiDocumentHref(
                id,
                row.path,
                row.title
              ),
              updatedAt: updatedDate.toISOString(),
              updatedLabel: formatDateLabel(updatedDate),
            };
          })
          .filter(
            (
              document
            ): document is HomeRecentDocument =>
              document !== null
          );
      }
    );
  } catch (error) {
    console.error(
      '[home] 최근 업데이트 문서 조회 실패:',
      error
    );

    return [];
  }
}