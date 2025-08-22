/** 전체 파일: lib/cdn.ts
 * - S3 퍼블릭 URL을 CloudFront 도메인으로 치환
 * - ?v= 파라미터로 캐시 무효화 지원
 *
 * 환경변수:
 *   NEXT_PUBLIC_CDN_BASE = https://d1y7k8qotewoph.cloudfront.net
 * (커스텀 도메인 연결 시 cdn.example.com 으로 변경)
 */

const CDN_DEFAULT = 'https://d1y7k8qotewoph.cloudfront.net';
const CDN = process.env.NEXT_PUBLIC_CDN_BASE || CDN_DEFAULT;

const CF_HOST = new URL(CDN).hostname;

// S3 호스트(글로벌/리전) 목록
const S3_HOSTS = new Set<string>([
  'rendog-wiki-images.s3.amazonaws.com',
  // 실제 사용 흔적이 있는 리전 호스트들 모두 허용
  'rdwiki.s3.ap-southeast-2.amazonaws.com',
  'rdwiki.s3.ap-northeast-2.amazonaws.com',
]);

/** S3 퍼블릭 URL을 CloudFront CDN 도메인으로 치환 */
export function cdn(url?: string | null): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    // 이미 CDN이면 그대로 반환
    if (u.hostname === CF_HOST) return url;

    // 1) 등록된 S3 호스트인 경우
    if (S3_HOSTS.has(u.hostname)) {
      u.hostname = CF_HOST;
      u.protocol = 'https:';
      return u.toString();
    }

    // 2) 일반화된 S3 호스트 패턴(s3.*, *.s3.*.amazonaws.com)도 커버
    if (/^(.+\.)?s3([.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(u.hostname)) {
      u.hostname = CF_HOST;
      u.protocol = 'https:';
      return u.toString();
    }

    return url;
  } catch {
    // 절대 URL이 아니면 정규식으로 한 번 더 시도(보수적)
    return url.replace(/https:\/\/[^/]*s3[^/]*\.amazonaws\.com/i, CDN);
  }
}

/** v 파라미터로 캐시 버스팅 (updatedAt, contentHash 등 전달) */
export function withVersion(url: string, v?: string | number): string {
  if (!url || !v) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('v', String(v));
    return u.toString();
  } catch {
    // 상대경로 방지용
    const u = new URL(url, 'https://dummy');
    u.searchParams.set('v', String(v));
    return url.includes('://')
      ? `${u.protocol}//${u.host}${u.pathname}?${u.searchParams.toString()}`
      : `${u.pathname}?${u.searchParams.toString()}`;
  }
}

/** SmartImage 등에서 사용: 주어진 src를 CDN으로 리라이트 */
export function toProxyUrl(src: string): string {
  return cdn(src);
}
