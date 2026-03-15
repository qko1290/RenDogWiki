// =============================================
// File: app/api/bootstrap/route.ts
// (전체 코드)
// - 위키 초기 bootstrap 데이터
// - 대표 문서는 메타만 내려주고 본문은 별도 /api/documents?id=... 로 로드
// - 로컬 TTL 캐시 + stale-on-error 사용
// - DB timeout 시에도 최소 구조를 반환하여 첫 화면 전체가 죽지 않게 처리
// =============================================

import { NextResponse } from 'next/server';
import { sql, runDbRead, isTransientDbError } from '@/wiki/lib/db';
import { cached } from '@/wiki/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FEATURED_ID = 73;

type BootstrapDocument = {
  id: number;
  title: string;
  path: string | number;
  icon?: string | null;
  is_featured?: boolean;
  special?: string | null;
  order: number;
  updated_at?: string | null;
};

type BootstrapFeaturedMeta = {
  id: number;
  title: string;
  path: string | number;
  icon?: string | null;
  tags?: string[] | string | null;
  special?: string | null;
  order?: number | null;
  updated_at?: string | null;
} | null;

type BootstrapPayload = {
  categories: any[];
  documents: BootstrapDocument[];
  featured: BootstrapFeaturedMeta;
  degraded?: boolean;
  stale?: boolean;
};

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  };
}

function emptyBootstrapPayload(extra?: Partial<BootstrapPayload>): BootstrapPayload {
  return {
    categories: [],
    documents: [],
    featured: null,
    ...extra,
  };
}

export async function GET() {
  try {
    const data = await cached<BootstrapPayload>(
      'bootstrap:v4',
      {
        ttlSec: 60,
        tags: ['category:list', 'category:tree', 'doc:list', `doc:${FEATURED_ID}`],
      },
      async () => {
        const categories = await runDbRead('bootstrap:categories', async () => {
          return await sql`
            SELECT
              id,
              name,
              parent_id,
              "order",
              document_id,
              icon,
              mode_tags
            FROM categories
            ORDER BY parent_id, "order"
          `;
        });

        const docs = await runDbRead('bootstrap:documents', async () => {
          return await sql`
            SELECT
              id,
              title,
              path,
              icon,
              is_featured,
              special,
              "order",
              updated_at
            FROM documents
          `;
        });

        const featuredRows = await runDbRead('bootstrap:featured-meta', async () => {
          return await sql`
            SELECT
              id,
              title,
              path,
              icon,
              tags,
              special,
              "order",
              updated_at
            FROM documents
            WHERE id = ${FEATURED_ID}
            LIMIT 1
          `;
        });

        const featuredRow = (featuredRows?.[0] ?? null) as
          | {
              id: number;
              title: string;
              path: string | number;
              icon?: string | null;
              tags?: string[] | string | null;
              special?: string | null;
              order?: number | null;
              updated_at?: string | null;
            }
          | null;

        const featured: BootstrapFeaturedMeta = featuredRow
          ? {
              id: featuredRow.id,
              title: featuredRow.title,
              path: featuredRow.path,
              icon: featuredRow.icon ?? null,
              tags: featuredRow.tags ?? null,
              special: featuredRow.special ?? null,
              order: featuredRow.order ?? null,
              updated_at: featuredRow.updated_at ?? null,
            }
          : null;

        return {
          categories,
          documents: (docs ?? []).map((r: any) => ({
            id: r.id,
            title: r.title,
            path: r.path,
            icon: r.icon,
            is_featured: !!r.is_featured,
            special: r.special ?? null,
            order: Number(r.order ?? 0),
            updated_at: r.updated_at,
          })),
          featured,
        };
      }
    );

    return NextResponse.json(data, {
      status: 200,
      headers: noStoreHeaders(),
    });
  } catch (e) {
    console.error('[bootstrap] error', e);

    if (isTransientDbError(e)) {
      return NextResponse.json(
        emptyBootstrapPayload({
          degraded: true,
        }),
        {
          status: 200,
          headers: noStoreHeaders(),
        }
      );
    }

    return NextResponse.json(
      { error: 'Server error' },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }
} 