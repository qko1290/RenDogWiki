// =============================================
// File: app/components/home/homeData.ts
// 전체 교체용 코드
//
// 핵심 수정:
// - 렌독위키의 루트 카테고리는 parent_id가 NULL 또는 0일 수 있음
// - 정식 카테고리명: 컨텐츠 / 시스템 / 시세표 / 법전
// - categories.document_id에 지정된 대표 문서를 연다
// - 잘못된 이전 결과 캐시를 피하기 위해 캐시 키 v4 사용
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

type HomeCategoryRow = {
  category_id: number | string;
  category_name: string;
  document_id: number | string | null;
  document_title: string | null;
};

const HOME_CATEGORY_DEFINITIONS: ReadonlyArray<{
  key: HomeCategoryKey;
  title: string;
}> = [
  {
    key: 'content',
    title: '컨텐츠',
  },
  {
    key: 'system',
    title: '시스템',
  },
  {
    key: 'price',
    title: '시세표',
  },
  {
    key: 'policy',
    title: '법전',
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
  documentId: number,
  categoryId: number,
  title: string
) {
  const searchParams =
    new URLSearchParams({
      id: String(documentId),
      path: String(categoryId),
      title,
    });

  return `/wiki?${searchParams.toString()}`;
}

function createEmptyCategoryLinks(): HomeCategoryLink[] {
  return HOME_CATEGORY_DEFINITIONS.map(
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
              const path = Number(row.path);
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
      'home:category-links:v4',
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
         * buildCategoryTree.ts와 동일한 루트 판정:
         * parent_id IS NULL 또는 parent_id = 0
         */
        const rows = (await runDbRead(
          'home:category-links:v4',
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
                (
                  category.parent_id IS NULL
                  OR category.parent_id = 0
                )
                AND category.name IN (
                  '컨텐츠',
                  '시스템',
                  '시세표',
                  '법전'
                )
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
        )) as unknown as HomeCategoryRow[];

        const firstRowByName =
          new Map<string, HomeCategoryRow>();

        for (const row of rows) {
          if (
            !firstRowByName.has(
              row.category_name
            )
          ) {
            firstRowByName.set(
              row.category_name,
              row
            );
          }
        }

        return HOME_CATEGORY_DEFINITIONS.map(
          (definition) => {
            const row =
              firstRowByName.get(
                definition.title
              ) ?? null;

            if (!row) {
              console.error(
                `[home] 루트 카테고리를 찾지 못했습니다: ${definition.title}`
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

            const validCategory =
              Number.isFinite(
                categoryId
              ) && categoryId > 0;

            const validRepresentativeDocument =
              Number.isFinite(
                documentId
              ) &&
              documentId > 0 &&
              documentTitle.length > 0;

            if (
              !validCategory ||
              !validRepresentativeDocument
            ) {
              console.error(
                `[home] 대표 문서가 지정되지 않았습니다: ${definition.title}`,
                {
                  categoryId:
                    validCategory
                      ? categoryId
                      : null,
                  documentId:
                    Number.isFinite(
                      documentId
                    )
                      ? documentId
                      : null,
                }
              );

              return {
                key: definition.key,
                title: definition.title,
                href: '/wiki',
                categoryId:
                  validCategory
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

    return createEmptyCategoryLinks();
  }
}