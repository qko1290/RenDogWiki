import { NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';

export async function GET() {
  const [{ now }] = await sql/*sql*/`select now()`;
  return NextResponse.json({ ok: true, now });
}
