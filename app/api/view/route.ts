import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import crypto from 'crypto';

const VIEW_COOLDOWN_MINUTES = 10;
const COOKIE_NAME = 'rd_vid';

function makeVisitorId() {
  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  let body: any = null;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 }
    );
  }

  const documentId = Number(body?.documentId);
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return NextResponse.json(
      { ok: false, error: 'invalid_documentId' },
      { status: 400 }
    );
  }

  let visitorId = req.cookies.get(COOKIE_NAME)?.value;
  let shouldSetCookie = false;

  if (!visitorId) {
    visitorId = makeVisitorId();
    shouldSetCookie = true;
  }

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
    // 1) 전체 누적 +1
    await sql`
      INSERT INTO document_stats_total (document_id, views, updated_at)
      VALUES (${documentId}, 1, NOW())
      ON CONFLICT (document_id)
      DO UPDATE SET
        views = document_stats_total.views + 1,
        updated_at = NOW()
    `;

    // 2) 오늘 일간 +1
    await sql`
      INSERT INTO document_stats_daily (day, document_id, views, updated_at)
      VALUES (CURRENT_DATE, ${documentId}, 1, NOW())
      ON CONFLICT (day, document_id)
      DO UPDATE SET
        views = document_stats_daily.views + 1,
        updated_at = NOW()
    `;
  }

  // 마지막 조회 시각 갱신
  await sql`
    INSERT INTO document_view_recent (document_id, visitor_id, last_viewed_at)
    VALUES (${documentId}, ${visitorId}, NOW())
    ON CONFLICT (document_id, visitor_id)
    DO UPDATE SET
      last_viewed_at = NOW()
  `;

  const res = NextResponse.json({
    ok: true,
    counted: !withinCooldown,
    cooldownMinutes: VIEW_COOLDOWN_MINUTES,
  });

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