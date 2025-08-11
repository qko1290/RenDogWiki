// =============================================
// File: app/api/npcs/order/route.ts
// =============================================
/**
 * [PATCH] /api/npcs/order
 * - NPC 리스트의 정렬 순서를 한 번에 업데이트
 * - 요청 Body
 *   {
 *     village_id?: number,           // 같은 마을만 제한(권장)
 *     npc_type?: string,             // "normal" | "quest" 등의 타입 제한(선택)
 *     orders: Array<{ id: number; order: number }>  // 변경 대상 (id, 새 order)
 *   }
 * - 응답: { success: true, updated: number }
 *
 * ⚠️ 주의
 * - 클라이언트에서 order는 1,2,3... 처럼 연속된 값으로 만들어 보내는 것을 권장합니다.
 * - 여기 구현은 간단하고 안전하게 "여러 UPDATE"를 순차 실행합니다.
 *   (원한다면 sql.begin 으로 트랜잭션을 적용하거나
 *    CASE WHEN 쿼리 1회로 묶는 방식으로 최적화 가능)
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/wiki/lib/db";

type OrderPair = { id: number; order: number };

export async function PATCH(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const village_id =
    body?.village_id !== undefined && body?.village_id !== null
      ? Number(body.village_id)
      : undefined;
  const npc_type: string | undefined =
    typeof body?.npc_type === "string" ? body.npc_type : undefined;

  // orders 검증 및 정제
  const rawOrders = Array.isArray(body?.orders) ? (body.orders as OrderPair[]) : [];
  const seen = new Set<number>();
  const orders: OrderPair[] = [];
  for (const it of rawOrders) {
    const id = Number(it?.id);
    const order = Number(it?.order);
    if (!Number.isFinite(id) || !Number.isFinite(order)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    orders.push({ id, order });
  }

  if (orders.length === 0) {
    return NextResponse.json({ error: "orders required" }, { status: 400 });
  }

  // 업데이트 (간단 버전: 여러 UPDATE를 순차 실행)
  // 필요시 sql.begin(async (tx)=>{ ... tx`UPDATE ...` ... }) 형태로 트랜잭션 처리 가능.
  let updated = 0;
  for (const { id, order } of orders) {
    const whereVillage = village_id !== undefined ? sql` AND village_id = ${village_id}` : sql``;
    const whereType = npc_type ? sql` AND npc_type = ${npc_type}` : sql``;

    const res = await sql`
      UPDATE npc
      SET "order" = ${order}
      WHERE id = ${id}
      ${whereVillage}
      ${whereType}
    `;
    // res.rowCount 가 있는 드라이버도 있지만, neondatabase/serverless는 배열 반환이므로 카운팅은 수동 증가
    updated += 1;
  }

  return NextResponse.json({ success: true, updated });
}
