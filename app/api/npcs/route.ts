// =============================================
// File: app/api/npc/route.ts (예시)
// =============================================
/**
 * NPC 목록 조회/추가 API
 * - [GET] 특정 마을(village_id)과 유형(npc_type)별 NPC 목록 반환
 * - [POST] 신규 NPC 추가
 * - pictures, rewards는 항상 배열로 처리 및 반환
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

/**
 * [NPC 목록 조회] GET
 * - 쿼리: village_id(필수), npc_type(quest|normal, 기본 normal)
 * - 반환: 해당 조건에 맞는 NPC 목록 (order, name 순 정렬)
 * - pictures, rewards는 항상 배열로 파싱되어 반환됨
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const village_id = Number(searchParams.get("village_id"));
  const npc_type = searchParams.get("npc_type") || "normal";

  // village_id 없으면 빈 배열 반환
  if (!village_id) return NextResponse.json([], { status: 200 });

  const rows = await sql`
    SELECT * FROM npc
    WHERE village_id = ${village_id}
      AND npc_type = ${npc_type}
    ORDER BY "order", name
  `;

  // pictures, rewards는 항상 배열로 보장
  rows.forEach(row => {
    row.pictures = Array.isArray(row.pictures)
      ? row.pictures
      : JSON.parse(row.pictures ?? "[]");
    row.rewards = Array.isArray(row.rewards)
      ? row.rewards
      : JSON.parse(row.rewards ?? "[]");
  });
  return NextResponse.json(rows);
}

/**
 * [NPC 추가] POST
 * - name, icon, village_id 필수
 * - 나머지 필드는 옵션
 * - pictures, rewards는 항상 배열로 저장
 * - 성공 시 추가된 NPC row 반환
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.name || !body.icon || !body.village_id) {
    return NextResponse.json({ error: "필수값 누락" }, { status: 400 });
  }

  const pictures = Array.isArray(body.pictures) ? body.pictures : [];
  const rewards = Array.isArray(body.rewards) ? body.rewards : [];

  const [row] = await sql`
    INSERT INTO npc
      (name, icon, village_id, "order", requirement, line,
      location_x, location_y, location_z, quest, npc_type, pictures, rewards)
    VALUES (
      ${body.name}, ${body.icon}, ${body.village_id}, ${body.order},
      ${body.requirement ?? null}, ${body.line ?? null},
      ${body.location_x}, ${body.location_y}, ${body.location_z},
      ${body.quest}, ${body.npc_type},
      ${JSON.stringify(pictures)},
      ${JSON.stringify(rewards)}
    )
    RETURNING *
  `;
  row.pictures = Array.isArray(row.pictures)
    ? row.pictures
    : JSON.parse(row.pictures ?? "[]");
  row.rewards = Array.isArray(row.rewards)
    ? row.rewards
    : JSON.parse(row.rewards ?? "[]");
  return NextResponse.json(row);
}
