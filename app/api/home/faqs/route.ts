// =============================================
// File: app/api/home/faqs/route.ts
// 전체 교체용 코드
//
// FAQ 인기 순위:
// - range=day
// - range=week (기본값, 오늘 포함 최근 7일)
// - range=total
//
// Home 렌더링을 막지 않도록 별도 API로 유지한다.
// =============================================

import { NextResponse } from 'next/server';

import {
  runDbRead,
  sql,
} from '@/wiki/lib/db';
import { cached } from '@/wiki/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RankingRange =
  | 'day'
  | 'week'
  | 'total';

type FaqRankRow = {
  id: number | string;
  title: string;
  views: number | string | bigint;
};

function normalizeRange(
  raw: string | null
): RankingRange | null {
  const value = String(
    raw ?? 'week'
  ).toLowerCase();

  return value === 'day' ||
    value === 'week' ||
    value === 'total'
    ? value
    : null;
}

export async function GET(
  request: Request
) {
  const { searchParams } =
    new URL(request.url);

  const range =
    normalizeRange(
      searchParams.get('range')
    );

  if (!range) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_range',
      },
      {
        status: 400,
      }
    );
  }

  const requestedLimit = Number(
    searchParams.get('limit') ?? 4
  );

  const limit = Number.isFinite(
    requestedLimit
  )
    ? Math.min(
        Math.max(
          Math.trunc(requestedLimit),
          1
        ),
        10
      )
    : 4;

  try {
    const items = await cached(
      `home:faq-ranking:${range}:${limit}:v2`,
      {
        ttlSec: 300,
        tags: ['faq:list'],
      },
      async () => {
        const rows = (await runDbRead(
          `api:home:faq-ranking:${range}`,
          async () => {
            if (range === 'total') {
              return await sql`
                SELECT
                  faq.id,
                  faq.title,
                  stats.views
                FROM faq_stats_total stats
                JOIN faq_questions faq
                  ON faq.id = stats.faq_id
                WHERE stats.views > 0
                ORDER BY
                  stats.views DESC,
                  faq.updated_at DESC
                    NULLS LAST,
                  faq.id DESC
                LIMIT ${limit}
              `;
            }

            if (range === 'day') {
              return await sql`
                SELECT
                  faq.id,
                  faq.title,
                  stats.views
                FROM faq_stats_daily stats
                JOIN faq_questions faq
                  ON faq.id = stats.faq_id
                WHERE
                  stats.day = CURRENT_DATE
                  AND stats.views > 0
                ORDER BY
                  stats.views DESC,
                  faq.updated_at DESC
                    NULLS LAST,
                  faq.id DESC
                LIMIT ${limit}
              `;
            }

            return await sql`
              WITH weekly_views AS (
                SELECT
                  faq_id,
                  SUM(views)::bigint
                    AS views
                FROM faq_stats_daily
                WHERE
                  day >= (
                    CURRENT_DATE -
                    INTERVAL '6 days'
                  )
                GROUP BY faq_id
              )
              SELECT
                faq.id,
                faq.title,
                weekly_views.views
              FROM weekly_views
              JOIN faq_questions faq
                ON faq.id =
                  weekly_views.faq_id
              WHERE weekly_views.views > 0
              ORDER BY
                weekly_views.views DESC,
                faq.updated_at DESC
                  NULLS LAST,
                faq.id DESC
              LIMIT ${limit}
            `;
          },
          0
        )) as unknown as FaqRankRow[];

        return rows
          .map((row) => {
            const id = Number(row.id);
            const title = String(
              row.title ?? ''
            ).trim();
            const views = Number(
              row.views ?? 0
            );

            if (
              !Number.isInteger(id) ||
              id <= 0 ||
              !title ||
              !Number.isFinite(views) ||
              views <= 0
            ) {
              return null;
            }

            return {
              id,
              title,
              views,
            };
          })
          .filter(
            (
              item
            ): item is {
              id: number;
              title: string;
              views: number;
            } => item !== null
          );
      }
    );

    return NextResponse.json(
      {
        ok: true,
        range,
        items,
      },
      {
        headers: {
          'Cache-Control':
            'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error(
      '[api/home/faqs] FAQ 순위 조회 실패:',
      error
    );

    return NextResponse.json(
      {
        ok: true,
        range,
        items: [],
        degraded: true,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
