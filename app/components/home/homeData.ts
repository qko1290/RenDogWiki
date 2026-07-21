// =============================================
// File: app/components/home/homeData.ts
// 전체 교체용 코드
// - Home 최근 업데이트 문서 조회
// - Home 대표 카테고리 4개의 실제 대표 문서 연결
// - 대표 문서가 없으면 해당 카테고리 하위의 최근 문서를 사용
// - DB 오류 시 Home 전체가 실패하지 않도록 fallback 반환
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

type CategoryTargetRow = {
  category_id: number | string;
  category_name: string;
  target_document_id: number | string | null;
  target_document_title: string | null;
  target_document_path: string | number | null;
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

const homeDateFormatter = new Intl.DateTimeFormat(
  'ko-KR',
  {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
  }
);

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

function normalizeCategoryName(value: string) {
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

              return {
                id,
                title: row.title,
                category:
                  row.category_name ||
                  '문서',
                href:
                  createWikiDocumentHref(
                    id,
                    row.path,
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
      'home:category-links',
      {
        ttlSec: 300,
        tags: [
          'category:list',
          'category:tree',
          'doc:list',
        ],
      },
      async () => {
        const rows = (await runDbRead(
          'home:category-links',
          async () => {
            return await sql`
              WITH RECURSIVE category_tree AS (
                SELECT
                  c.id AS root_id,
                  c.id AS category_id
                FROM categories c

                UNION ALL

                SELECT
                  tree.root_id,
                  child.id AS category_id
                FROM category_tree tree
                JOIN categories child
                  ON child.parent_id =
                    tree.category_id
              )
              SELECT
                category.id AS category_id,
                category.name AS category_name,
                COALESCE(
                  representative.id,
                  fallback_document.id
                ) AS target_document_id,
                COALESCE(
                  representative.title,
                  fallback_document.title
                ) AS target_document_title,
                COALESCE(
                  representative.path,
                  fallback_document.path
                ) AS target_document_path
              FROM categories category
              LEFT JOIN documents representative
                ON representative.id =
                  category.document_id
              LEFT JOIN LATERAL (
                SELECT
                  document.id,
                  document.title,
                  document.path
                FROM category_tree tree
                JOIN documents document
                  ON document.path::text =
                    tree.category_id::text
                WHERE tree.root_id =
                  category.id
                ORDER BY
                  CASE
                    WHEN document.path::text =
                      category.id::text
                    THEN 0
                    ELSE 1
                  END,
                  document.updated_at
                    DESC NULLS LAST,
                  document.id DESC
                LIMIT 1
              ) fallback_document
                ON TRUE
              ORDER BY
                category.parent_id
                  NULLS FIRST,
                category."order",
                category.id
            `;
          }
        )) as unknown as CategoryTargetRow[];

        const rowByNormalizedName =
          new Map<string, CategoryTargetRow>();

        for (const row of rows) {
          const normalizedName =
            normalizeCategoryName(
              row.category_name
            );

          if (
            normalizedName &&
            !rowByNormalizedName.has(
              normalizedName
            )
          ) {
            rowByNormalizedName.set(
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
                  rowByNormalizedName.get(
                    normalizeCategoryName(
                      alias
                    )
                  )
                )
                .find(Boolean) ?? null;

            if (!row) {
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
              row.target_document_id
            );
            const documentTitle =
              String(
                row.target_document_title ??
                  ''
              ).trim();

            const hasDocument =
              Number.isFinite(documentId) &&
              documentId > 0 &&
              documentTitle.length > 0;

            return {
              key: definition.key,
              title: definition.title,
              href: hasDocument
                ? createWikiDocumentHref(
                    documentId,
                    row.target_document_path,
                    documentTitle
                  )
                : '/wiki',
              categoryId:
                Number.isFinite(
                  categoryId
                ) && categoryId > 0
                  ? categoryId
                  : null,
              documentId: hasDocument
                ? documentId
                : null,
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
