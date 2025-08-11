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

type NpcRow = {
  id: number;
  name: string;
  icon: string;
  location_x: number;
  location_y: number;
  location_z: number;
  line: string | null;
  village_id: number;
  order: number;
  requirement: string | null;
  quest: string;
  npc_type: string;      // "normal" | "quest"
  pictures: any;         // DB에 json/text 형태일 수 있음
  rewards: any;
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();

  // 1) 현재 행 조회 (⚠️ 제네릭 제거)
  const rows = await sql`SELECT * FROM npc WHERE id = ${id}`;
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 2) 현재값 파싱
  const cur = rows[0] as NpcRow;
  const curPictures = Array.isArray(cur.pictures) ? cur.pictures : JSON.parse(cur.pictures ?? "[]");
  const curRewards  = Array.isArray(cur.rewards)  ? cur.rewards  : JSON.parse(cur.rewards  ?? "[]");

  // 3) body에 온 필드만 덮어쓰는 병합 (없으면 기존값 유지)
  const merged = {
    name:        body.name        ?? cur.name,
    icon:        body.icon        ?? cur.icon,
    location_x:  body.location_x  ?? cur.location_x,
    location_y:  body.location_y  ?? cur.location_y,
    location_z:  body.location_z  ?? cur.location_z,
    line:        body.line        ?? cur.line,
    village_id:  body.village_id  ?? cur.village_id,
    order:       body.order       ?? cur.order,
    requirement: body.requirement ?? cur.requirement,
    quest:       body.quest       ?? cur.quest,
    npc_type:    body.npc_type    ?? cur.npc_type,
    pictures:    body.pictures === undefined ? curPictures : (Array.isArray(body.pictures) ? body.pictures : []),
    rewards:     body.rewards  === undefined ? curRewards  : (Array.isArray(body.rewards)  ? body.rewards  : []),
  };

  // 4) 업데이트
  await sql`
    UPDATE npc SET
      name = ${merged.name},
      icon = ${merged.icon},
      location_x = ${merged.location_x},
      location_y = ${merged.location_y},
      location_z = ${merged.location_z},
      line = ${merged.line},
      village_id = ${merged.village_id},
      "order" = ${merged.order},
      requirement = ${merged.requirement},
      quest = ${merged.quest},
      npc_type = ${merged.npc_type},
      pictures = ${JSON.stringify(merged.pictures)},
      rewards  = ${JSON.stringify(merged.rewards)}
    WHERE id = ${id}
  `;

  // 5) 갱신본 반환 (⚠️ 제네릭 제거)
  const updatedRows = await sql`SELECT * FROM npc WHERE id = ${id}`;
  const updated = updatedRows[0] as NpcRow;
  updated.pictures = Array.isArray(updated.pictures)
    ? updated.pictures
    : JSON.parse(updated.pictures ?? "[]");
  updated.rewards = Array.isArray(updated.rewards)
    ? updated.rewards
    : JSON.parse(updated.rewards ?? "[]");

  return NextResponse.json(updated);
}