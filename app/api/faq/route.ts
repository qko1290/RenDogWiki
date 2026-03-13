// =============================================
// File: app/api/faq/route.ts
// (전체 코드)
// - FAQ 목록/생성
// - title / tags:
//   1) 부분검색
//   2) 공백 제거 검색
//   3) pg_trgm 유사도 검색
//   4) 비연속 글자 매칭(subsequence regex)
// - content:
//   - 일반 검색 + 공백 제거 검색 복구
//   - 비연속 매칭 / trgm 미적용
// - no-store 강제
// =============================================
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { requireRole } from '@/app/wiki/lib/requireRole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function compactSearchText(v: string) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function normalizeSearchText(v: string) {
  return String(v ?? '').toLowerCase().trim();
}

function shouldUseTrgm(raw: string) {
  return compactSearchText(raw).length >= 3;
}

function shouldUseLooseRegex(raw: string) {
  return compactSearchText(raw).length >= 2;
}

function escapeRegexChar(ch: string) {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeLooseRegex(raw: string) {
  const compact = compactSearchText(raw);
  if (!compact) return '';
  return compact
    .split('')
    .map(escapeRegexChar)
    .join('.*');
}

function pgArrayToJs(input: unknown): string[] {
  if (Array.isArray(input)) return input as string[];
  if (typeof input !== 'string') return [];
  const s = input.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return s ? [s] : [];

  const inner = s.slice(1, -1);
  if (!inner) return [];

  const out: string[] = [];
  let cur = '';
  let inQ = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"' && inner[i - 1] !== '\\') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur.replace(/\\"/g, '"'));
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.replace(/\\"/g, '"'));

  return out.map(v => v.trim()).filter(Boolean);
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map(String).map(s => s.trim()).filter(Boolean))];
  }
  if (typeof tags === 'string') {
    return [...new Set(tags.split(',').map(s => s.trim()).filter(Boolean))];
  }
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

    const normalizedQ = normalizeSearchText(q);
    const compactQ = compactSearchText(q);
    const pattern = `%${q}%`;
    const compactPattern = `%${compactQ}%`;
    const useTrgm = shouldUseTrgm(q);
    const useLooseRegex = shouldUseLooseRegex(q);
    const looseRegex = makeLooseRegex(q);

    const rows = await sql`
      SELECT
        f.id,
        f.title,
        f.content,
        f.tags,
        f.uploader,
        f.created_at,
        f.updated_at,
        CASE
          WHEN ${q} = '' THEN 999
          ELSE GREATEST(
            CASE
              WHEN LOWER(COALESCE(f.title, '')) = ${normalizedQ} THEN 100
              WHEN LOWER(COALESCE(f.title, '')) LIKE LOWER(${pattern}) THEN 80
              WHEN regexp_replace(LOWER(COALESCE(f.title, '')), '\\s+', '', 'g') LIKE ${compactPattern} THEN 72
              WHEN ${useLooseRegex}
                AND regexp_replace(LOWER(COALESCE(f.title, '')), '\\s+', '', 'g') ~ ${looseRegex}
                THEN 66

              WHEN LOWER(COALESCE(array_to_string(f.tags, ' '), '')) LIKE LOWER(${pattern}) THEN 60
              WHEN regexp_replace(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), '\\s+', '', 'g') LIKE ${compactPattern} THEN 54
              WHEN ${useLooseRegex}
                AND regexp_replace(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), '\\s+', '', 'g') ~ ${looseRegex}
                THEN 50

              WHEN LOWER(COALESCE(f.content, '')) LIKE LOWER(${pattern}) THEN 30
              WHEN regexp_replace(LOWER(COALESCE(f.content, '')), '\\s+', '', 'g') LIKE ${compactPattern} THEN 28

              ELSE 0
            END,
            CASE
              WHEN ${useTrgm}
                THEN GREATEST(
                  similarity(LOWER(COALESCE(f.title, '')), ${normalizedQ}) * 60,
                  similarity(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), ${normalizedQ}) * 45
                )
              ELSE 0
            END
          )
        END AS score
      FROM faq_questions f
      WHERE
        (
          ${q} = ''
          OR LOWER(COALESCE(f.title, '')) LIKE LOWER(${pattern})
          OR regexp_replace(LOWER(COALESCE(f.title, '')), '\\s+', '', 'g') LIKE ${compactPattern}
          OR (
            ${useLooseRegex}
            AND regexp_replace(LOWER(COALESCE(f.title, '')), '\\s+', '', 'g') ~ ${looseRegex}
          )
          OR LOWER(COALESCE(array_to_string(f.tags, ' '), '')) LIKE LOWER(${pattern})
          OR regexp_replace(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), '\\s+', '', 'g') LIKE ${compactPattern}
          OR (
            ${useLooseRegex}
            AND regexp_replace(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), '\\s+', '', 'g') ~ ${looseRegex}
          )
          OR LOWER(COALESCE(f.content, '')) LIKE LOWER(${pattern})
          OR regexp_replace(LOWER(COALESCE(f.content, '')), '\\s+', '', 'g') LIKE ${compactPattern}
          OR (
            ${useTrgm}
            AND (
              similarity(LOWER(COALESCE(f.title, '')), ${normalizedQ}) >= 0.2
              OR similarity(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), ${normalizedQ}) >= 0.2
            )
          )
        )
        AND (
          ${tagsCsv} = ''
          OR EXISTS (
            SELECT 1
            FROM unnest(f.tags) AS tag
            JOIN unnest(string_to_array(${tagsCsv}, ',')) AS input_tag ON TRUE
            WHERE REPLACE(tag, ' ', '') = REPLACE(TRIM(input_tag), ' ', '')
          )
        )
      ORDER BY
        CASE WHEN ${q} = '' THEN f.created_at END DESC,
        score DESC,
        f.created_at DESC,
        f.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await sql`
      SELECT COUNT(*) AS cnt
      FROM faq_questions f
      WHERE
        (
          ${q} = ''
          OR LOWER(COALESCE(f.title, '')) LIKE LOWER(${pattern})
          OR regexp_replace(LOWER(COALESCE(f.title, '')), '\\s+', '', 'g') LIKE ${compactPattern}
          OR (
            ${useLooseRegex}
            AND regexp_replace(LOWER(COALESCE(f.title, '')), '\\s+', '', 'g') ~ ${looseRegex}
          )
          OR LOWER(COALESCE(array_to_string(f.tags, ' '), '')) LIKE LOWER(${pattern})
          OR regexp_replace(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), '\\s+', '', 'g') LIKE ${compactPattern}
          OR (
            ${useLooseRegex}
            AND regexp_replace(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), '\\s+', '', 'g') ~ ${looseRegex}
          )
          OR LOWER(COALESCE(f.content, '')) LIKE LOWER(${pattern})
          OR regexp_replace(LOWER(COALESCE(f.content, '')), '\\s+', '', 'g') LIKE ${compactPattern}
          OR (
            ${useTrgm}
            AND (
              similarity(LOWER(COALESCE(f.title, '')), ${normalizedQ}) >= 0.2
              OR similarity(LOWER(COALESCE(array_to_string(f.tags, ' '), '')), ${normalizedQ}) >= 0.2
            )
          )
        )
        AND (
          ${tagsCsv} = ''
          OR EXISTS (
            SELECT 1
            FROM unnest(f.tags) AS tag
            JOIN unnest(string_to_array(${tagsCsv}, ',')) AS input_tag ON TRUE
            WHERE REPLACE(tag, ' ', '') = REPLACE(TRIM(input_tag), ' ', '')
          )
        )
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
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

// POST /api/faq  {title, content, tags?: string[]|csv}
export async function POST(req: Request) {
  const gate = await requireRole(['writer', 'admin']);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { 'content-type': 'application/json' },
    });
  }

  const uploader = gate.dbUser.minecraft_name || gate.dbUser.username || 'unknown';

  try {
    const body = await req.json();
    const title = String(body?.title ?? '').trim();
    const content = String(body?.content ?? '').trim();
    const tagsCsv = normalizeTags(body?.tags).join(',');

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Missing title/content' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

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
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}