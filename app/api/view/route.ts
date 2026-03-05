import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const documentId = Number(body?.documentId);
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_documentId' }, { status: 400 });
  }

  // ✅ 서버 기준 "오늘" (DB timezone 영향을 줄이려면 DB에서 CURRENT_DATE 쓰는 게 제일 안전)
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

  return NextResponse.json({ ok: true });
}