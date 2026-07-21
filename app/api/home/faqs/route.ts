// =============================================
// File: app/api/home/faqs/route.ts
// 전체 신규 파일
//
// FAQ 누적 열람수 기준 상위 4개를 반환한다.
// Home 렌더링을 막지 않도록 별도 API로 분리한다.
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

const FAQ_LIMIT = 4;

type FaqRankRow = {
  id: number | string;
  title: string;
  views: number | string | bigint;
};

export async function GET() {
  try {
    const items = await cached(
      'home:faq-ranking:v1',
      {
        /*
         * 열람 순위는 5분 단위로 갱신한다.
         * Home 방문마다 같은 순위 쿼리를 반복하지 않는다.
         */
        ttlSec: 300,
        tags: ['faq:list'],
      },
      async () => {
        const rows = (await runDbRead(
          'api:home:faq-ranking',
          async () => {
            return await sql`
              SELECT
                faq.id,
                faq.title,
                COALESCE(
                  faq.views,
                  0
                )::bigint AS views
              FROM faq_questions faq
              ORDER BY
                COALESCE(
                  faq.views,
                  0
                ) DESC,
                faq.updated_at DESC
                  NULLS LAST,
                faq.created_at DESC,
                faq.id DESC
              LIMIT ${FAQ_LIMIT}
            `;
          },

          /*
           * 부가 영역이므로 DB 연결 실패 시 재시도하지 않는다.
           */
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
              !Number.isFinite(views)
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

    /*
     * FAQ 순위는 부가 영역이므로 Home 전체에
     * 오류를 전파하지 않고 빈 목록을 반환한다.
     */
    return NextResponse.json(
      {
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
