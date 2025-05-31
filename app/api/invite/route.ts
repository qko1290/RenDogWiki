import { inviteUser } from "@/app/api/invite/invite"; // invite.ts 파일에 있는 함수 가져옴
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name } = body;

    if (!email || !name) {
      return NextResponse.json({ error: "Missing email or name" }, { status: 400 });
    }

    const result = await inviteUser(email, name);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    console.error("초대 API 실패:", err);
    return NextResponse.json({ error: "Invite failed", details: String(err) }, { status: 500 });
  }
}
