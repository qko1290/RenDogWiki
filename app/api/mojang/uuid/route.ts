// GET /api/mojang/uuid?name=Q_Ko
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');
  if (!name) return NextResponse.json({ error: '닉네임이 없습니다.' }, { status: 400 });

  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${name}`);
    if (!res.ok) return NextResponse.json({ error: '유효하지 않은 닉네임입니다.' }, { status: 404 });

    const data = await res.json();
    return NextResponse.json({ uuid: data.id });
  } catch (e) {
    return NextResponse.json({ error: 'Mojang API 요청 실패' }, { status: 500 });
  }
}