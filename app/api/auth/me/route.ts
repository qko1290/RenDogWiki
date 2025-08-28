// =============================================
// File: app/api/auth/me/route.ts
// (DB 최신 반환 + 레거시 토큰 자동 재발급 + 강제 동적 + private no-store 캐시 헤더)
// =============================================
/**
 * 현재 로그인 사용자 정보 & 회원 탈퇴
 * - GET -> 쿠키의 JWT를 검증하고 DB에서 최신 사용자 정보를 반환
 * - DELETE -> 비밀번호 확인 후 본인 계정을 삭제하고 JWT 쿠키를 만료
 * - 캐시 정책: private, no-store (+ Vary: Cookie)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/wiki/lib/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'guest' | 'writer' | 'admin';
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Vary': 'Cookie',
};

export async function GET() {
  try {
    const auth = getAuthUser();
    if (!auth) {
      return NextResponse.json(
        { loggedIn: false, role: 'guest', roles: [], permissions: [] },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    // 최신 사용자 정보 조회
    const rows = await sql`
      SELECT id, username, email, minecraft_name, role
      FROM users
      WHERE id = ${auth.id}
      LIMIT 1
    `;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { loggedIn: false, role: 'guest', roles: [], permissions: [] },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    const dbUser = rows[0] as any;
    const role: Role = String(dbUser.role || 'guest').toLowerCase() as Role;

    // ── 레거시/불완전 토큰 자동 정정 ─────────────────────────────
    let needsRefresh = false;
    const c = cookies();
    const token = c.get('token')?.value;

    if (token) {
      try {
        const payload: any = jwt.verify(token, JWT_SECRET);
        // 레거시 클레임(username/minecraft_name/email) 존재 or 필수(id/role) 누락 → 갱신
        if (
          payload?.username !== undefined ||
          payload?.minecraft_name !== undefined ||
          payload?.email !== undefined ||
          payload?.id == null ||
          payload?.role == null
        ) {
          needsRefresh = true;
        }
        // id 불일치 보호
        if (payload?.id != null && Number(payload.id) !== Number(dbUser.id)) {
          needsRefresh = true;
        }
      } catch {
        // 검증 실패 → 새 토큰 발급
        needsRefresh = true;
      }
    }

    const res = NextResponse.json(
      {
        loggedIn: true,
        user: dbUser,
        role,
        roles: [],
        permissions: [],
      },
      { headers: PRIVATE_NO_STORE_HEADERS }
    );

    if (needsRefresh) {
      const newToken = jwt.sign(
        { sub: dbUser.id, id: dbUser.id, role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.cookies.set('token', newToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return res;
  } catch (err) {
    console.error('[auth/me:GET] unexpected error:', err);
    return NextResponse.json(
      { error: '사용자 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
    }

    // 본문 파싱 -> 비밀번호 필수
    const body = await req.json().catch(() => null);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password) {
      return NextResponse.json(
        { error: '비밀번호가 필요합니다.' },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    // 현재 사용자 비밀번호 검증
    const rows = await sql`
      SELECT id, password_hash
      FROM users
      WHERE id = ${auth.id}
      LIMIT 1
    `;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    const ok = await bcrypt.compare(
      password as string,
      (rows[0] as any).password_hash as string
    );
    if (!ok) {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    // 사용자 삭제
    await sql`DELETE FROM users WHERE id = ${auth.id}`;

    // JWT 쿠키 만료
    const res = NextResponse.json(
      { message: '탈퇴 완료' },
      { headers: PRIVATE_NO_STORE_HEADERS }
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
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
}
