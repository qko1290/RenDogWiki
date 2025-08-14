// =============================================
// File: app/api/chat/reaction/route.ts
// =============================================
/**
 * 메시지 반응 토글
 * - POST body -> { messageId: number, kind: 'like' | 'dislike' }
 * - 규칙 -> 같은 반응을 다시 누르면 해제, 다른 반응을 누르면 기존 반응 제거 후 새 반응 추가
 * - 배열 컬럼이 null일 수 있어도 동작하도록 COALESCE 처리
 */

import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';
import { ablyRest, GLOBAL_CHANNEL } from '@/wiki/lib/ably';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const me = getAuthUser();
    if (!me) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const body = await req.json().catch(() => null);
    const id = Number(body?.messageId);
    const rawKind = typeof body?.kind === 'string' ? body.kind.trim() : '';
    const kind = rawKind === 'dislike' ? 'dislike' : rawKind === 'like' ? 'like' : '';

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: 'bad-id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (!kind) {
      return NextResponse.json(
        { error: 'bad-kind' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 한 번의 UPDATE로 상호배타 토글 -> 배열이 null이어도 빈 배열로 간주
    const updated = (await sql/*sql*/`
      UPDATE chat_messages
      SET
        liked_by =
          CASE
            WHEN ${kind} = 'like' THEN
              CASE
                WHEN ${me.id} = ANY(COALESCE(liked_by, '{}'::int[]))
                  THEN array_remove(COALESCE(liked_by, '{}'::int[]), ${me.id})
                ELSE array_append(array_remove(COALESCE(liked_by, '{}'::int[]), ${me.id}), ${me.id})
              END
            ELSE array_remove(COALESCE(liked_by, '{}'::int[]), ${me.id})
          END,
        disliked_by =
          CASE
            WHEN ${kind} = 'dislike' THEN
              CASE
                WHEN ${me.id} = ANY(COALESCE(disliked_by, '{}'::int[]))
                  THEN array_remove(COALESCE(disliked_by, '{}'::int[]), ${me.id})
                ELSE array_append(array_remove(COALESCE(disliked_by, '{}'::int[]), ${me.id}), ${me.id})
              END
            ELSE array_remove(COALESCE(disliked_by, '{}'::int[]), ${me.id})
          END
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING
        id,
        cardinality(liked_by)    AS like_count,
        cardinality(disliked_by) AS dislike_count,
        COALESCE(${me.id} = ANY(liked_by), false)    AS i_liked,
        COALESCE(${me.id} = ANY(disliked_by), false) AS i_disliked
    `) as unknown as Array<{
      id: number;
      like_count: number;
      dislike_count: number;
      i_liked: boolean;
      i_disliked: boolean;
    }>;

    const row = updated[0];
    if (!row) {
      return NextResponse.json(
        { error: 'not-found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const payload = {
      id: row.id,
      like_count: row.like_count,
      dislike_count: row.dislike_count,
    };

    // 전체에게 카운트 브로드캐스트
    await ablyRest.channels.get(GLOBAL_CHANNEL).publish('reaction.updated', payload);

    // 내 클라이언트는 즉시 상태 적용 가능하도록 현재 사용자 기준 상태도 함께 반환
    return NextResponse.json(
      { ...payload, i_liked: row.i_liked, i_disliked: row.i_disliked },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('/api/chat/reaction error:', e);
    return NextResponse.json(
      { error: 'reaction-failed', detail: String(e?.message || e) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
