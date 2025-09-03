// =============================================
// File: app/api/chat/reaction/route.ts — 전체 코드 (교체용)
// =============================================
/**
 * 채팅 메시지 리액션 토글
 * - POST body -> { id: number, type: 'like' | 'dislike' }
 * - 인증 필요 -> getAuthUser()
 * - 동작:
 *   1) 기존 내 리액션 조회
 *   2) 같은 타입이면 취소(삭제), 다른 타입이면 전환, 없으면 추가
 *   3) 최신 집계(like/dislike)와 내 상태(i_liked/i_disliked) 반환
 *   4) Ably 브로드캐스트('reaction.updated')
 * - 응답은 실시간 특성상 캐시 금지
 */

import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReactionType = 'like' | 'dislike';

export async function POST(req: Request) {
  try {
    const me = getAuthUser();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'X-App-Cache': 'OFF' } });
    }

    const body = await req.json().catch(() => null);
    const msgId = Number(body?.id);
    const type = body?.type as ReactionType;

    if (!Number.isFinite(msgId) || (type !== 'like' && type !== 'dislike')) {
      return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400, headers: { 'Cache-Control': 'no-store', 'X-App-Cache': 'OFF' } });
    }

    // ===== 트랜잭션처럼 순서 보장해서 처리 =====
    // 1) 내 기존 리액션 조회
    const existing = (await sql/*sql*/`
      SELECT id, type
      FROM chat_reactions
      WHERE message_id = ${msgId} AND user_id = ${me.id}
      LIMIT 1
    `) as unknown as Array<{ id: number; type: ReactionType }>;

    if (existing.length) {
      const prev = existing[0];
      if (prev.type === type) {
        // 같은 타입 -> 취소(삭제)
        await sql/*sql*/`
          DELETE FROM chat_reactions
          WHERE id = ${prev.id}
        `;
      } else {
        // 다른 타입 -> 전환(update)
        await sql/*sql*/`
          UPDATE chat_reactions
          SET type = ${type}
          WHERE id = ${prev.id}
        `;
      }
    } else {
      // 없으면 추가
      await sql/*sql*/`
        INSERT INTO chat_reactions (message_id, user_id, type)
        VALUES (${msgId}, ${me.id}, ${type})
      `;
    }

    // 2) 최신 집계
    const counts = (await sql/*sql*/`
      SELECT
        SUM(CASE WHEN type = 'like' THEN 1 ELSE 0 END)::int AS like_count,
        SUM(CASE WHEN type = 'dislike' THEN 1 ELSE 0 END)::int AS dislike_count
      FROM chat_reactions
      WHERE message_id = ${msgId}
    `) as unknown as Array<{ like_count: number; dislike_count: number }>;
    const { like_count = 0, dislike_count = 0 } = counts[0] ?? { like_count: 0, dislike_count: 0 };

    // 3) 내 현재 상태
    const mine = (await sql/*sql*/`
      SELECT type
      FROM chat_reactions
      WHERE message_id = ${msgId} AND user_id = ${me.id}
      LIMIT 1
    `) as unknown as Array<{ type: ReactionType }>;
    const i_liked = !!mine.length && mine[0].type === 'like';
    const i_disliked = !!mine.length && mine[0].type === 'dislike';

    const payload = {
      id: msgId,
      like_count,
      dislike_count,
      i_liked,
      i_disliked,
      user_id: me.id,
    };

    // 4) Ably — 요청 시점 동적 import (빌드 타임 실행 방지)
    const { ablyRest, GLOBAL_CHANNEL } = await import('@/wiki/lib/ably');
    if (!ablyRest) {
      throw new Error('Ably 클라이언트가 초기화되지 않았습니다. 환경변수를 확인하세요.');
    }

    await ablyRest.channels.get(GLOBAL_CHANNEL).publish('reaction.updated', payload);

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store', 'X-App-Cache': 'OFF' },
    });
  } catch (e: any) {
    console.error('/api/chat/reaction error:', e);
    return NextResponse.json(
      { error: 'reaction-failed', detail: String(e?.message || e) },
      { status: 500, headers: { 'Cache-Control': 'no-store', 'X-App-Cache': 'OFF' } }
    );
  }
}
