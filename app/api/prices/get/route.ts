// =============================================
// File: app/api/prices/get/route.ts  (전체 코드)
// =============================================
import { NextResponse } from "next/server";
import { sql } from "@/app/wiki/lib/db";

function toNameKey(input: string): string {
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\u200B/g, "")
    .trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const idParam = searchParams.get("id");
    const nameKeyParam = searchParams.get("name_key");

    const byId =
      idParam != null && idParam !== "" ? Number(idParam) : null;
    const byNameKey =
      nameKeyParam != null && nameKeyParam.trim()
        ? toNameKey(nameKeyParam)
        : null;

    if (
      !(Number.isFinite(byId as any) && (byId as number) > 0) &&
      !byNameKey
    ) {
      return NextResponse.json(
        { error: "missing_param", message: "id 또는 name_key가 필요합니다." },
        { status: 400 }
      );
    }

    const rows = await sql<
      Array<{
        id: number;
        name: string;
        name_key: string;
        mode: string;
        prices: string[];
        updated_at: string;
      }>
    >`
      select
        id,
        name,
        name_key,
        mode,
        prices,
        updated_at
      from public.price_items
      where
        (${byId}::bigint is not null and id = ${byId})
        or (${byNameKey}::text is not null and name_key = ${byNameKey})
      limit 1;
    `;

    const item = rows?.[0] ?? null;
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    console.error("GET /api/prices/get failed:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}