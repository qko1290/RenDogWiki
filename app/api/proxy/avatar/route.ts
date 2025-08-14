// =============================================
// File: app/api/proxy/avatar/route.ts — 전체 코드 (신규)
// =============================================
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 허용 외부 호스트 화이트리스트
const ALLOWED_HOSTS = new Set([
  'crafatar.com',
  'crafthead.net',
  'minotar.net',
  'mc-heads.net',
  // 필요하면 서브도메인 추가 예) 'www.crafthead.net'
]);

function isAllowed(url: URL) {
  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) return true;
  // www.* 자동 허용 (옵션)
  if (host.startsWith('www.') && ALLOWED_HOSTS.has(host.slice(4))) return true;
  return false;
}

export async function GET(req: NextRequest) {
  try {
    // ?u=<절대URL>
    const raw = req.nextUrl.searchParams.get('u') || '';
    if (!raw) {
      return NextResponse.json({ error: 'missing-url' }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return NextResponse.json({ error: 'invalid-url' }, { status: 400 });
    }

    if (!isAllowed(target)) {
      return NextResponse.json({ error: 'forbidden-host' }, { status: 403 });
    }

    // 서버에서 외부 이미지를 받아 동일 출처로 전달
    const upstream = await fetch(target.toString(), {
      // redirect: 'follow',
      // 헤더가 필요하면 최소만 추가
      // headers: { 'User-Agent': 'RenDogWiki/1.0 (+vercel)' },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'upstream-failed', status: upstream.status },
        { status: 502 }
      );
    }

    const contentType =
      upstream.headers.get('content-type') ?? 'image/png';

    // 적당한 캐시: CDN 10분, 브라우저 1분
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=600, max-age=60',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'proxy-error', detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
