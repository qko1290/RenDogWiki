// =============================================
// File: app/api/faq/[id]/route.ts
// (FAQ 단건 조회/수정/삭제 - no-store 강제 + dynamic 강제)
// =============================================
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export const runtime = 'nodejs';

// ✅ Next/서버 레벨 캐시까지 확실히 방지
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

/** PG text[] -> string[] */
function pgArrayToJs(input: unknown): string[] {
  if (Array.isArray(input)) return input as string[];
  if (typeof input !== 'string') return [];
  const s = input.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return s ? [s] : [];
  const inner = s.slice(1, -1);
  if (!inner) return [];
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"' && inner[i - 1] !== '\\') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur.replace(/\\"/g, '"')); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.replace(/\\"/g, '"'));
  return out.map(v => v.trim()).filter(Boolean);
}

/** 입력 태그 정규화: 배열/CSV -> CSV, 미제공이면 null */
function normalizeTagsToCsv(tags: unknown): string | null {
  if (tags == null) return null;
  if (Array.isArray(tags)) {
    const norm = [...new Set(tags.map(String).map(s => s.trim()).filter(Boolean))];
    return norm.join(',');
  }
  if (typeof tags === 'string') {
    const norm = [...new Set(tags.split(',').map(s => s.trim()).filter(Boolean))];
    return norm.join(',');
  }
  return null;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const rows = await sql`
      SELECT id, title, content, tags, uploader, created_at, updated_at
      FROM faq_questions
      WHERE id = ${id}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });

    return NextResponse.json(
      {
        id: r.id,
        title: r.title,
        content: r.content,
        tags: pgArrayToJs(r.tags),
        uploader: r.uploader,
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error('FAQ 단건 조회 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const body = await req.json();
    const title: string | null = body?.title != null ? String(body.title).trim() : null;
    const content: string | null = body?.content != null ? String(body.content).trim() : null;
    const tagsCsv: string | null = normalizeTagsToCsv(body?.tags);

    const rows = await sql`
      UPDATE faq_questions
      SET
        title   = COALESCE(${title}::text,   title),
        content = COALESCE(${content}::text, content),
        tags =
          CASE
            WHEN ${tagsCsv}::text IS NULL THEN tags
            WHEN ${tagsCsv}::text = ''   THEN ARRAY[]::text[]
            ELSE string_to_array(${tagsCsv}::text, ',')
          END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, title, content, tags, uploader, created_at, updated_at
    `;

    const r = rows[0];
    if (!r) {
      return NextResponse.json({ error: 'not found' }, { status: 404, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json(
      {
        id: r.id,
        title: r.title,
        content: r.content,
        tags: pgArrayToJs(r.tags),
        uploader: r.uploader,
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error('FAQ 수정 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    await sql`DELETE FROM faq_questions WHERE id = ${id}`;
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error('FAQ 삭제 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}