// =============================================
// File: app/api/wiki-embed/search/route.ts  (전체 코드)
// (텍스트 링크 할당용 검색 API: quest/npc/qna)
// - quest/npc: public.npc 테이블에서 npc_type로 구분
// - qna: public.faq_questions 테이블 사용
// - no-store + dynamic 강제
// =============================================
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

type Kind = 'quest' | 'npc' | 'qna';
const ALLOWED_KIND = new Set<Kind>(['quest', 'npc', 'qna']);

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, ' ');
}

/**
 * kind -> npc_type 매핑
 * 너 DB 기본값이 'normal'인 점 기준으로:
 * - npc  => npc_type='normal'
 * - quest=> npc_type='quest'
 *
 * 만약 네 프로젝트에서 quest가 'quest'가 아니라 다른 값이면 여기만 바꾸면 됨.
 */
function kindToNpcType(kind: 'npc' | 'quest') {
  return kind === 'npc' ? 'normal' : 'quest';
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const kind = (sp.get('kind') ?? '').trim() as Kind;
    const q = normalizeQuery(sp.get('q') ?? '');
    const limit = Math.max(1, Math.min(50, toInt(sp.get('limit'), 20)));

    if (!ALLOWED_KIND.has(kind) || !q) {
      return NextResponse.json({ items: [] }, { headers: NO_STORE_HEADERS });
    }

    // ------------------------------------------------------------
    // ✅ NPC / QUEST: public.npc 테이블
    // ------------------------------------------------------------
    if (kind === 'npc' || kind === 'quest') {
      const npcType = kindToNpcType(kind);

      // name 우선 검색 + (원하면 quest 컬럼도 같이 검색)
      // - 인덱스: idx_npc_village_type_order_name (village_id, npc_type, order, name)
      // - 여기서는 npc_type 필터 + name ILIKE가 핵심
      const rows = await sql/*sql*/`
        SELECT id, name, icon, village_id, npc_type, "order"
        FROM npc
        WHERE npc_type = ${npcType}
          AND (
            name ILIKE ${'%' + q + '%'}
            OR quest ILIKE ${'%' + q + '%'}  -- ✅ 퀘스트 텍스트 필드도 검색에 포함(원치 않으면 제거)
          )
        ORDER BY
          CASE WHEN name ILIKE ${q + '%'} THEN 0 ELSE 1 END,
          "order" ASC,
          name ASC
        LIMIT ${limit}
      `;

      const items = (rows as any[]).map((r) => ({
        id: Number(r.id),
        title: String(r.name ?? ''),
        subtitle: `village_id=${r.village_id} · type=${r.npc_type ?? ''} · order=${r.order ?? 0}`,
        icon: r.icon ? String(r.icon) : '',
      }));

      return NextResponse.json({ items }, { headers: NO_STORE_HEADERS });
    }

    // ------------------------------------------------------------
    // ✅ QNA: public.faq_questions 테이블
    // - title/content/trgm 인덱스가 있으니 ILIKE 검색 OK
    // ------------------------------------------------------------
    if (kind === 'qna') {
      const rows = await sql/*sql*/`
        SELECT id, title, tags, created_at
        FROM faq_questions
        WHERE
          title   ILIKE ${'%' + q + '%'}
          OR content ILIKE ${'%' + q + '%'}
          OR EXISTS (
            SELECT 1
            FROM unnest(tags) AS tag
            WHERE REPLACE(tag, ' ', '') ILIKE ${'%' + q.replace(/\s+/g, '') + '%'}
          )
        ORDER BY
          CASE WHEN title ILIKE ${q + '%'} THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT ${limit}
      `;

      const items = (rows as any[]).map((r) => ({
        id: Number(r.id),
        title: String(r.title ?? ''),
        subtitle: Array.isArray(r.tags) && r.tags.length ? `#${r.tags.join(' #')}` : '',
        icon: '',
      }));

      return NextResponse.json({ items }, { headers: NO_STORE_HEADERS });
    }

    return NextResponse.json({ items: [] }, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error('[wiki-embed search] error:', e);
    // 검색은 실패해도 UX상 빈 배열 반환이 더 안전
    return NextResponse.json({ items: [] }, { headers: NO_STORE_HEADERS });
  }
}