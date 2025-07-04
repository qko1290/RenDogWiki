// app/api/image/folder/list/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/wiki/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parent_id = searchParams.get("parent_id");

  let result;
  if (!parent_id) {
  result = await db.query('SELECT * FROM image_folders ORDER BY id ASC');
} else {
  result = await db.query(
    'SELECT * FROM image_folders WHERE parent_id = $1 ORDER BY id ASC',
    [parseInt(parent_id)]
  );
}
return NextResponse.json(result.rows);
}
