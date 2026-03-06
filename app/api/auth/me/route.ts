// =============================================
// File: app/api/auth/me/route.ts
// =============================================
/**
 * 현재 로그인 사용자 정보 & 회원 탈퇴
 * - GET -> 쿠키의 JWT를 검증하고 DB에서 최신 사용자 정보를 반환
 * - DELETE -> 비밀번호 확인 후 본인 계정을 삭제하고 JWT 쿠키를 만료
 * - 실시간 성격의 데이터 -> 캐시는 no-store로 응답
 *
 * 개선:
 * - GET /api/auth/me 는 "로그인 여부 확인용" 성격으로 사용되므로
 *   비로그인 상태를 401이 아닌 200 + guest 응답으로 반환
 * - DELETE 는 실제 인증이 필요한 작업이므로 401 유지
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';
import bcrypt from 'bcryptjs';

type Role = 'guest' | 'writer' | 'admin';

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store',
    'X-App-Cache': 'OFF',
  };
}

export async function GET() {
  try {
    const auth = getAuthUser();

    // ✅ 비로그인 = 정상적인 "게스트 상태"
    if (!auth) {
      return NextResponse.json(
        {
          loggedIn: false,
          user: null,
          role: 'guest',
          roles: [],
          permissions: [],
        },
        { status: 200, headers: noStoreHeaders() }
      );
    }

    // ✅ auth 존재 확인 뒤에만 DB 조회
    const rows = await sql`
      SELECT id, username, email, minecraft_name, role
      FROM users
      WHERE id = ${auth.id}
      LIMIT 1
    `;

    // ✅ 토큰은 있는데 DB 유저가 없으면 게스트 처리
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        {
          loggedIn: false,
          user: null,
          role: 'guest',
          roles: [],
          permissions: [],
        },
        { status: 200, headers: noStoreHeaders() }
      );
    }

    const dbUser = rows[0] as {
      id: number;
      username: string;
      email: string;
      minecraft_name: string;
      role?: string | null;
    };

    const roleRaw = String(dbUser.role || 'guest').toLowerCase();
    const role: Role =
      roleRaw === 'admin' || roleRaw === 'writer' ? (roleRaw as Role) : 'guest';

    return NextResponse.json(
      {
        loggedIn: true,
        user: dbUser,
        role,
        roles: [],
        permissions: [],
      },
      { status: 200, headers: noStoreHeaders() }
    );
  } catch (err) {
    console.error('[auth/me:GET] unexpected error:', err);
    return NextResponse.json(
      { error: '사용자 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthUser();

    if (!auth) {
      return NextResponse.json(
        { error: '인증 필요' },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const body = await req.json().catch(() => null);
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!password) {
      return NextResponse.json(
        { error: '비밀번호가 필요합니다.' },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const rows = await sql`
      SELECT id, password_hash
      FROM users
      WHERE id = ${auth.id}
      LIMIT 1
    `;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404, headers: noStoreHeaders() }
      );
    }

    const ok = await bcrypt.compare(
      password,
      (rows[0] as { password_hash: string }).password_hash
    );

    if (!ok) {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    await sql`DELETE FROM users WHERE id = ${auth.id}`;

    const res = NextResponse.json(
      { message: '탈퇴 완료' },
      { status: 200, headers: noStoreHeaders() }
    );

    res.cookies.set('token', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    return res;
  } catch (err) {
    console.error('[auth/me:DELETE] unexpected error:', err);
    return NextResponse.json(
      { error: '탈퇴 처리 중 오류가 발생했습니다.' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}