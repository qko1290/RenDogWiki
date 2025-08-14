// =============================================
// File: app/api/auth/me/route.ts
// =============================================
/**
 * 현재 로그인 사용자 정보 & 회원 탈퇴
 * - GET -> 쿠키의 JWT를 검증하고 DB에서 최신 사용자 정보를 반환
 * - DELETE -> 비밀번호 확인 후 본인 계정을 삭제하고 JWT 쿠키를 만료
 * - 실시간 성격의 데이터 -> 캐시는 no-store로 응답
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/wiki/lib/db';
import { getAuthUser } from '@/app/wiki/lib/auth'; // 경로 일관성은 프로젝트 설정에 맞춰 사용
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const auth = getAuthUser();
    if (!auth) {
      return NextResponse.json(
        { loggedIn: false },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 최신 사용자 정보 조회 -> 필요한 컬럼만 선택
    const rows = await sql`
      SELECT id, username, email, minecraft_name, role
      FROM users
      WHERE id = ${auth.id}
      LIMIT 1
    `;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { loggedIn: false },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { loggedIn: true, user: rows[0] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[auth/me:GET] unexpected error:', err);
    return NextResponse.json(
      { error: '사용자 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    }

    // 본문 파싱 -> 비밀번호 필수
    const body = await req.json().catch(() => null);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password) {
      return NextResponse.json(
        { error: '비밀번호가 필요합니다.' },
        { status: 400 }
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
        { status: 404 }
      );
    }

    const ok = await bcrypt.compare(
      password as string,
      (rows[0] as any).password_hash as string
    );
    if (!ok) {
      return NextResponse.json(
        { error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    // 사용자 삭제 -> 연관 데이터 처리 전략은 별도 정책에 따름
    await sql`DELETE FROM users WHERE id = ${auth.id}`;

    // JWT 쿠키 만료 -> 로그인과 동일한 옵션으로 지워야 확실함
    const res = NextResponse.json(
      { message: '탈퇴 완료' },
      { headers: { 'Cache-Control': 'no-store' } }
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
      { status: 500 }
    );
  }
}
