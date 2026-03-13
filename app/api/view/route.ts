// =============================================
// File: app/api/view/route.ts
// (전체 코드)
// - 문서 조회수 기록
// - DB 불안정 시에도 문서 열람을 방해하지 않도록 best-effort 처리
// - DISABLE_VIEW_TRACKING=1 이면 완전 비활성화
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VIEW_COOLDOWN_MINUTES = 10;
const COOKIE_NAME = 'rd_vid';

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

  // 운영 중 긴급 차단용
  if (process.env.DISABLE_VIEW_TRACKING === '1') {
    const res = NextResponse.json(
      {
        ok: true,
        counted: false,
        skipped: 'disabled',
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
      await sql`
        INSERT INTO document_stats_total (document_id, views, updated_at)
        VALUES (${documentId}, 1, NOW())
        ON CONFLICT (document_id)
        DO UPDATE SET
          views = document_stats_total.views + 1,
          updated_at = NOW()
      `;

      await sql`
        INSERT INTO document_stats_daily (day, document_id, views, updated_at)
        VALUES (CURRENT_DATE, ${documentId}, 1, NOW())
        ON CONFLICT (day, document_id)
        DO UPDATE SET
          views = document_stats_daily.views + 1,
          updated_at = NOW()
      `;
    }

    await sql`
      INSERT INTO document_view_recent (document_id, visitor_id, last_viewed_at)
      VALUES (${documentId}, ${visitorId}, NOW())
      ON CONFLICT (document_id, visitor_id)
      DO UPDATE SET
        last_viewed_at = NOW()
    `;

    const res = NextResponse.json(
      {
        ok: true,
        counted: !withinCooldown,
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
    // 조회수 기록은 비핵심 기능이라 문서 로딩을 방해하면 안 됨
    if (isConnectTimeoutError(err)) {
      console.warn('[view] DB timeout, skipping tracking');

      const res = NextResponse.json(
        {
          ok: true,
          counted: false,
          skipped: 'db_timeout',
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