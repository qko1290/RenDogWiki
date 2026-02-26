// =============================================
// File: app/api/faq/route.ts
// (FAQ 목록/생성 - 앱 메모리 캐시(cached) 제거 + no-store 강제)
// =============================================
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';

export const runtime = 'nodejs';

// ✅ Next/Edge/서버 렌더 캐시까지 확실히 방지
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  // 프록시/CDN 포함 캐시 차단
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

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

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return [...new Set(tags.map(String).map(s => s.trim()).filter(Boolean))];
  if (typeof tags === 'string') return [...new Set(tags.split(',').map(s => s.trim()).filter(Boolean))];
  return [];
}

// GET /api/faq?q=&tags=&limit=&offset=
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') ?? '').trim();
    const tagsCsv = (sp.get('tags') ?? '').trim();
    const limit = Math.max(1, Math.min(100, Number(sp.get('limit') ?? 20)));
    const offset = Math.max(0, Number(sp.get('offset') ?? 0));

    // ✅ 캐시 제거: 매 요청마다 DB 최신 조회
    const rows = await sql`
      SELECT id, title, content, tags, uploader, created_at, updated_at
      FROM faq_questions
      WHERE (${q} = '' OR title ILIKE ${'%' + q + '%'} OR content ILIKE ${'%' + q + '%'})
        AND (${tagsCsv} = '' OR tags && string_to_array(${tagsCsv}, ','))
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await sql`
      SELECT COUNT(*) AS cnt
      FROM faq_questions
      WHERE (${q} = '' OR title ILIKE ${'%' + q + '%'} OR content ILIKE ${'%' + q + '%'})
        AND (${tagsCsv} = '' OR tags && string_to_array(${tagsCsv}, ','))
    `;

    const data = {
      items: rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        tags: pgArrayToJs(r.tags),
        uploader: r.uploader,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      total: Number(totalRows[0]?.cnt ?? 0),
    };

    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error('FAQ 목록 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

// POST /api/faq  {title, content, tags?: string[]|csv}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = String(body?.title ?? '').trim();
    const content = String(body?.content ?? '').trim();
    const tagsCsv = normalizeTags(body?.tags).join(',');

    if (!title || !content) {
      return NextResponse.json({ error: 'Missing title/content' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const user = getAuthUser();
    const uploader = user?.minecraft_name ?? req.headers.get('x-wiki-username') ?? 'anonymous';

    const rows = await sql`
      INSERT INTO faq_questions (title, content, tags, uploader)
      VALUES (${title}, ${content}, string_to_array(${tagsCsv}, ','), ${uploader})
      RETURNING id, title, content, tags, uploader, created_at, updated_at
    `;

    const r = rows[0];
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
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error('FAQ 생성 실패:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}