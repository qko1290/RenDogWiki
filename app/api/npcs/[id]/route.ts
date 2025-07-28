// =============================================
// File: app/api/npc/[id]/route.ts
// =============================================
/**
 * NPC 정보 수정 API
 * - [PATCH] 특정 NPC(id)의 정보를 수정
 * - 입력값: name, icon, location_x, location_y, location_z, line, village_id, order, requirement, quest, npc_type, pictures, rewards
 * - pictures, rewards는 항상 배열로 처리하여 JSON 문자열로 저장
 * - 수정 후, 갱신된 NPC 정보를 반환
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

/**
 * [NPC 정보 수정] PATCH
 * - params.id: NPC 고유 id
 * - body: 수정할 필드들
 * - pictures, rewards는 항상 배열(JSON)로 보장
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. id 파싱/검증
  const id = Number(params.id);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // 2. body 파싱
  const body = await req.json();

  // 3. pictures, rewards는 배열로 보장
  const pictures = Array.isArray(body.pictures) ? body.pictures : [];
  const rewards = Array.isArray(body.rewards) ? body.rewards : [];

  // 4. DB 업데이트
  await sql`
    UPDATE npc SET
      name = ${body.name},
      icon = ${body.icon},
      location_x = ${body.location_x},
      location_y = ${body.location_y},
      location_z = ${body.location_z},
      line = ${body.line},
      village_id = ${body.village_id},
      "order" = ${body.order},
      requirement = ${body.requirement},
      quest = ${body.quest},
      npc_type = ${body.npc_type},
      pictures = ${JSON.stringify(pictures)},
      rewards = ${JSON.stringify(rewards)}
    WHERE id = ${id}
  `;

  // 5. 수정된 NPC 정보 조회 후 반환
  const [updated] = await sql`
    SELECT * FROM npc WHERE id = ${id}
  `;
  updated.pictures = Array.isArray(updated.pictures)
    ? updated.pictures
    : JSON.parse(updated.pictures ?? "[]");
  updated.rewards = Array.isArray(updated.rewards)
    ? updated.rewards
    : JSON.parse(updated.rewards ?? "[]");

  return NextResponse.json(updated);
}
