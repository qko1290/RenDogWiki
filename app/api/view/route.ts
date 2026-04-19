// =============================================
// File: app/api/view/route.ts
// (전체 코드)
// - 문서 조회수 기록
// - source(category/search/link/other) 함께 집계
// - 기존 10분 쿨다운 유지
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VIEW_COOLDOWN_MINUTES = 10;
const COOKIE_NAME = 'rd_vid';

const SOURCE_VALUES = ['category', 'search', 'link', 'other'] as const;
type DocViewSource = (typeof SOURCE_VALUES)[number];

function makeVisitorId() {
  return crypto.randomUUID();
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  };
}

function isConnectTimeoutError(err: unknown) {
  const e = err as any;
  return (
    e?.code === 'CONNECT_TIMEOUT' ||
    e?.errno === 'CONNECT_TIMEOUT' ||
    String(e?.message ?? '').includes('CONNECT_TIMEOUT')
  );
}

function normalizeSource(raw: unknown): DocViewSource {
  const value = String(raw ?? '').trim();
  return SOURCE_VALUES.includes(value as DocViewSource)
    ? (value as DocViewSource)
    : 'other';
}

async function bumpTotal(documentId: number, source: DocViewSource) {
  switch (source) {
    case 'category':
      await sql`
        INSERT INTO document_stats_total (
          document_id, views, category_views, updated_at
        )
        VALUES (${documentId}, 1, 1, NOW())
        ON CONFLICT (document_id) DO UPDATE
        SET
          views = document_stats_total.views + 1,
          category_views = document_stats_total.category_views + 1,
          updated_at = NOW()
      `;
      return;

    case 'search':
      await sql`
        INSERT INTO document_stats_total (
          document_id, views, search_views, updated_at
        )
        VALUES (${documentId}, 1, 1, NOW())
        ON CONFLICT (document_id) DO UPDATE
        SET
          views = document_stats_total.views + 1,
          search_views = document_stats_total.search_views + 1,
          updated_at = NOW()
      `;
      return;

    case 'link':
      await sql`
        INSERT INTO document_stats_total (
          document_id, views, link_views, updated_at
        )
        VALUES (${documentId}, 1, 1, NOW())
        ON CONFLICT (document_id) DO UPDATE
        SET
          views = document_stats_total.views + 1,
          link_views = document_stats_total.link_views + 1,
          updated_at = NOW()
      `;
      return;

    case 'other':
    default:
      await sql`
        INSERT INTO document_stats_total (
          document_id, views, other_views, updated_at
        )
        VALUES (${documentId}, 1, 1, NOW())
        ON CONFLICT (document_id) DO UPDATE
        SET
          views = document_stats_total.views + 1,
          other_views = document_stats_total.other_views + 1,
          updated_at = NOW()
      `;
      return;
  }
}

async function bumpDaily(documentId: number, source: DocViewSource) {
  switch (source) {
    case 'category':
      await sql`
        INSERT INTO document_stats_daily (
          day, document_id, views, category_views, updated_at
        )
        VALUES (CURRENT_DATE, ${documentId}, 1, 1, NOW())
        ON CONFLICT (day, document_id) DO UPDATE
        SET
          views = document_stats_daily.views + 1,
          category_views = document_stats_daily.category_views + 1,
          updated_at = NOW()
      `;
      return;

    case 'search':
      await sql`
        INSERT INTO document_stats_daily (
          day, document_id, views, search_views, updated_at
        )
        VALUES (CURRENT_DATE, ${documentId}, 1, 1, NOW())
        ON CONFLICT (day, document_id) DO UPDATE
        SET
          views = document_stats_daily.views + 1,
          search_views = document_stats_daily.search_views + 1,
          updated_at = NOW()
      `;
      return;

    case 'link':
      await sql`
        INSERT INTO document_stats_daily (
          day, document_id, views, link_views, updated_at
        )
        VALUES (CURRENT_DATE, ${documentId}, 1, 1, NOW())
        ON CONFLICT (day, document_id) DO UPDATE
        SET
          views = document_stats_daily.views + 1,
          link_views = document_stats_daily.link_views + 1,
          updated_at = NOW()
      `;
      return;

    case 'other':
    default:
      await sql`
        INSERT INTO document_stats_daily (
          day, document_id, views, other_views, updated_at
        )
        VALUES (CURRENT_DATE, ${documentId}, 1, 1, NOW())
        ON CONFLICT (day, document_id) DO UPDATE
        SET
          views = document_stats_daily.views + 1,
          other_views = document_stats_daily.other_views + 1,
          updated_at = NOW()
      `;
      return;
  }
}

export async function POST(req: NextRequest) {
  let body: any = null;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const documentId = Number(body?.documentId);
  const source = normalizeSource(body?.source);

  if (!Number.isFinite(documentId) || documentId <= 0) {
    return NextResponse.json(
      { ok: false, error: 'invalid_documentId' },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  let visitorId = req.cookies.get(COOKIE_NAME)?.value;
  let shouldSetCookie = false;

  if (!visitorId) {
    visitorId = makeVisitorId();
    shouldSetCookie = true;
  }

  if (process.env.DISABLE_VIEW_TRACKING === '1') {
    const res = NextResponse.json(
      {
        ok: true,
        counted: false,
        skipped: 'disabled',
        source,
        cooldownMinutes: VIEW_COOLDOWN_MINUTES,
      },
      { headers: noStoreHeaders() }
    );

    if (shouldSetCookie) {
      res.cookies.set(COOKIE_NAME, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return res;
  }

  try {
    const recentRows = await sql<{ last_viewed_at: string }[]>`
      SELECT last_viewed_at
      FROM document_view_recent
      WHERE document_id = ${documentId}
        AND visitor_id = ${visitorId}
      LIMIT 1
    `;

    const now = Date.now();
    const lastViewedAt = recentRows[0]?.last_viewed_at
      ? new Date(recentRows[0].last_viewed_at).getTime()
      : 0;

    const cooldownMs = VIEW_COOLDOWN_MINUTES * 60 * 1000;
    const withinCooldown = !!lastViewedAt && now - lastViewedAt < cooldownMs;

    if (!withinCooldown) {
      await bumpTotal(documentId, source);
      await bumpDaily(documentId, source);
    }

    await sql`
      INSERT INTO document_view_recent (
        document_id, visitor_id, last_viewed_at
      )
      VALUES (${documentId}, ${visitorId}, NOW())
      ON CONFLICT (document_id, visitor_id)
      DO UPDATE SET last_viewed_at = NOW()
    `;

    const res = NextResponse.json(
      {
        ok: true,
        counted: !withinCooldown,
        source,
        cooldownMinutes: VIEW_COOLDOWN_MINUTES,
      },
      { headers: noStoreHeaders() }
    );

    if (shouldSetCookie) {
      res.cookies.set(COOKIE_NAME, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return res;
  } catch (err) {
    if (isConnectTimeoutError(err)) {
      console.warn('[view] DB timeout, skipping tracking');

      const res = NextResponse.json(
        {
          ok: true,
          counted: false,
          skipped: 'db_timeout',
          source,
          cooldownMinutes: VIEW_COOLDOWN_MINUTES,
        },
        { headers: noStoreHeaders() }
      );

      if (shouldSetCookie) {
        res.cookies.set(COOKIE_NAME, visitorId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
        });
      }

      return res;
    }

    console.error('[view] unexpected error:', err);

    return NextResponse.json(
      { ok: false, error: 'server_error' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}