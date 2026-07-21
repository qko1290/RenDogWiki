// =============================================
// File: app/components/home/homeData.ts
// 전체 교체용 코드
//
// 수정 핵심:
// 1. 대표 카테고리는 최상위 카테고리에서만 찾음
// 2. categories.document_id에 지정된 대표 문서만 사용
// 3. URL의 path에는 문서의 path가 아니라 클릭한 카테고리 id를 사용
// 4. 임의의 최근 하위 문서 fallback 제거
// 5. 기존 오답 캐시와 분리하기 위해 캐시 키 v2 사용
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

export type HomeCategoryKey =
  | 'content'
  | 'system'
  | 'price'
  | 'policy';

export type HomeCategoryLink = {
  key: HomeCategoryKey;
  title: string;
  href: string;
  categoryId: number | null;
  documentId: number | null;
};

type RecentDocumentRow = {
  id: number | string;
  title: string;
  path: string | number | null;
  updated_at: string | Date | null;
  category_name: string | null;
};

type RootCategoryRow = {
  category_id: number | string;
  category_name: string;
  document_id: number | string | null;
  document_title: string | null;
};

const CATEGORY_DEFINITIONS: ReadonlyArray<{
  key: HomeCategoryKey;
  title: string;
  aliases: readonly string[];
}> = [
  {
    key: 'content',
    title: '콘텐츠',
    aliases: ['콘텐츠', '컨텐츠'],
  },
  {
    key: 'system',
    title: '시스템',
    aliases: ['시스템'],
  },
  {
    key: 'price',
    title: '시세표',
    aliases: ['시세표', '시세'],
  },
  {
    key: 'policy',
    title: '운영 원칙',
    aliases: ['운영 원칙', '운영원칙'],
  },
];

const homeDateFormatter =
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
  });

function normalizeDate(
  value: string | Date | null
) {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDateLabel(date: Date) {
  const parts =
    homeDateFormatter.formatToParts(date);

  const month =
    parts.find(
      (part) => part.type === 'month'
    )?.value ?? '--';

  const day =
    parts.find(
      (part) => part.type === 'day'
    )?.value ?? '--';

  return `${month}.${day}`;
}

function createWikiDocumentHref(
  id: number,
  categoryId: number,
  title: string
) {
  const searchParams =
    new URLSearchParams({
      id: String(id),
      path: String(categoryId),
      title,
    });

  return `/wiki?${searchParams.toString()}`;
}

function normalizeCategoryName(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function createCategoryFallbacks(): HomeCategoryLink[] {
  return CATEGORY_DEFINITIONS.map(
    (definition) => ({
      key: definition.key,
      title: definition.title,
      href: '/wiki',
      categoryId: null,
      documentId: null,
    })
  );
}

export async function getRecentHomeDocuments(
  requestedLimit = 4
): Promise<HomeRecentDocument[]> {
  const limit = Math.min(
    Math.max(
      Math.trunc(requestedLimit),
      1
    ),
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
                COALESCE(
                  c.name,
                  '문서'
                ) AS category_name
              FROM documents d
              LEFT JOIN categories c
                ON c.id::text =
                  d.path::text
              WHERE
                d.updated_at IS NOT NULL
              ORDER BY
                d.updated_at DESC,
                d.id DESC
              LIMIT ${limit}
            `;
          }
        )) as unknown as RecentDocumentRow[];

        return rows
          .map(
            (
              row
            ): HomeRecentDocument | null => {
              const id = Number(row.id);
              const updatedDate =
                normalizeDate(
                  row.updated_at
                );

              if (
                !Number.isFinite(id) ||
                id <= 0 ||
                !row.title ||
                !updatedDate
              ) {
                return null;
              }

              const path = Number(row.path);

              return {
                id,
                title: row.title,
                category:
                  row.category_name ||
                  '문서',
                href:
                  createWikiDocumentHref(
                    id,
                    Number.isFinite(path)
                      ? path
                      : 0,
                    row.title
                  ),
                updatedAt:
                  updatedDate.toISOString(),
                updatedLabel:
                  formatDateLabel(
                    updatedDate
                  ),
              };
            }
          )
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

export async function getHomeCategoryLinks(): Promise<
  HomeCategoryLink[]
> {
  try {
    return await cached(
      'home:category-links:v2',
      {
        ttlSec: 60,
        tags: [
          'category:list',
          'category:tree',
          'doc:list',
        ],
      },
      async () => {
        /*
         * CategoryTree와 동일한 의미를 사용한다.
         *
         * - 대표 카테고리 버튼은 최상위 카테고리를 대상으로 함
         * - 이동 대상은 categories.document_id
         * - path는 대표 문서 자체의 path가 아니라
         *   사용자가 클릭한 category.id
         */
        const rows = (await runDbRead(
          'home:category-links:v2',
          async () => {
            return await sql`
              SELECT
                category.id
                  AS category_id,
                category.name
                  AS category_name,
                category.document_id
                  AS document_id,
                document.title
                  AS document_title
              FROM categories category
              LEFT JOIN documents document
                ON document.id =
                  category.document_id
              WHERE
                category.parent_id IS NULL
              ORDER BY
                CASE
                  WHEN EXISTS (
                    SELECT 1
                    FROM unnest(
                      COALESCE(
                        category.mode_tags,
                        '{}'::text[]
                      )
                    ) AS mode_tag
                    WHERE
                      LOWER(mode_tag) = 'rpg'
                  )
                  THEN 0
                  ELSE 1
                END,
                category."order",
                category.id
            `;
          }
        )) as unknown as RootCategoryRow[];

        const rowByName =
          new Map<string, RootCategoryRow>();

        for (const row of rows) {
          const normalizedName =
            normalizeCategoryName(
              row.category_name
            );

          if (
            normalizedName &&
            !rowByName.has(
              normalizedName
            )
          ) {
            rowByName.set(
              normalizedName,
              row
            );
          }
        }

        return CATEGORY_DEFINITIONS.map(
          (definition) => {
            const row =
              definition.aliases
                .map((alias) =>
                  rowByName.get(
                    normalizeCategoryName(
                      alias
                    )
                  )
                )
                .find(
                  (
                    candidate
                  ): candidate is RootCategoryRow =>
                    candidate !== undefined
                ) ?? null;

            if (!row) {
              console.warn(
                `[home] 최상위 카테고리를 찾지 못했습니다: ${definition.title}`
              );

              return {
                key: definition.key,
                title: definition.title,
                href: '/wiki',
                categoryId: null,
                documentId: null,
              };
            }

            const categoryId = Number(
              row.category_id
            );
            const documentId = Number(
              row.document_id
            );
            const documentTitle =
              String(
                row.document_title ?? ''
              ).trim();

            const hasCategory =
              Number.isFinite(
                categoryId
              ) && categoryId > 0;

            const hasRepresentative =
              Number.isFinite(
                documentId
              ) &&
              documentId > 0 &&
              documentTitle.length > 0;

            if (
              !hasCategory ||
              !hasRepresentative
            ) {
              console.warn(
                `[home] 대표 문서가 지정되지 않은 카테고리입니다: ${row.category_name}`
              );

              return {
                key: definition.key,
                title: definition.title,
                href: '/wiki',
                categoryId:
                  hasCategory
                    ? categoryId
                    : null,
                documentId: null,
              };
            }

            return {
              key: definition.key,
              title: definition.title,
              href:
                createWikiDocumentHref(
                  documentId,
                  categoryId,
                  documentTitle
                ),
              categoryId,
              documentId,
            };
          }
        );
      }
    );
  } catch (error) {
    console.error(
      '[home] 대표 카테고리 연결 조회 실패:',
      error
    );

    return createCategoryFallbacks();
  }
}