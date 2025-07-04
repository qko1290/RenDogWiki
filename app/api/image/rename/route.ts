import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';

export async function PATCH(req: NextRequest) {
  const { id, name } = await req.json();
  if (!id || !name) {
    return NextResponse.json({ error: 'id와 name이 필요합니다.' }, { status: 400 });
  }
  await db.query('UPDATE images SET name = $1 WHERE id = $2', [name, id]);
  return NextResponse.json({ success: true });
}
