// =============================================
// File: app/api/mojang/uuid/route.ts
// =============================================
/**
 * 마인크래프트 닉네임 -> Mojang UUID 조회
 * - GET 쿼리 -> ?name=<minecraft_name>
 * - 닉네임 형식 체크(영문/숫자/언더스코어, 3~16자)
 * - Mojang REST 호출 결과
 *   - 200 -> { uuid }
 *   - 204/404 -> 닉네임 없음
 * - 모든 응답은 캐시 금지
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 닉네임 규칙(자바 에디션): 영문/숫자/언더스코어, 3~16자
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = sp.get('name') ?? '';
  const name = raw.trim();

  // 1) 입력 검증
  if (!name) {
    return NextResponse.json(
      { error: '닉네임이 없습니다.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (!NAME_RE.test(name)) {
    return NextResponse.json(
      { error: '닉네임 형식이 올바르지 않습니다.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    // 2) Mojang API 호출 (타임아웃 포함)
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 7000); // 7초 타임아웃

    const url = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(
      name
    )}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      // next: { revalidate: 0 } // Next가 이해하긴 하지만 헤더로도 no-store를 내려줌
    }).finally(() => clearTimeout(t));

    // Mojang은 존재하지 않으면 204(No Content)를 주는 경우가 있음
    if (res.status === 204 || res.status === 404) {
      return NextResponse.json(
        { error: '유효하지 않은 닉네임입니다.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: '업스트림 오류(Mojang)' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3) 성공 -> uuid 추출
    const data = await res.json().catch(() => null as any);
    const id = typeof data?.id === 'string' ? data.id : null;

    if (!id || id.length < 16) {
      // 형식이 이상하면 닉네임 없음과 동일 처리
      return NextResponse.json(
        { error: '유효하지 않은 닉네임입니다.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { uuid: id }, // Mojang이 주는 하이픈 제거된 32자 형태 그대로 반환
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    // 네트워크/타임아웃 등
    return NextResponse.json(
      { error: 'Mojang API 요청 실패' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
