/** 전체 파일: lib/cdn.ts
 * - S3 퍼블릭 URL을 CloudFront 도메인으로 치환
 * - ?v= 파라미터로 캐시 무효화 지원
 *
 * 환경변수:
 *   NEXT_PUBLIC_CDN_BASE = https://d1y7k8qotewoph.cloudfront.net
 * (커스텀 도메인 연결 시 cdn.example.com 으로 변경)
 */

const CDN_DEFAULT = 'https://d1y7k8qotewoph.cloudfront.net';
const CDN = process.env.NEXT_PUBLIC_CDN_BASE || 'https://d1y7k8qotewoph.cloudfront.net';

const S3_REGIONAL = 'https://rdwiki.s3.ap-northeast-2.amazonaws.com';
const S3_GLOBAL   = 'https://rdwiki.s3.amazonaws.com';
const CF_HOST = 'd1y7k8qotewoph.cloudfront.net';            // CloudFront 도메인
const S3_HOST = 'rendog-wiki-images.s3.amazonaws.com';      // S3 도메인

/** S3 퍼블릭 URL을 CloudFront CDN 도메인으로 치환 */
export function cdn(url?: string | null): string {
  if (!url) return '';
  // CloudFront가 아닌 s3.amazonaws.com 이 들어오면 CDN으로 교체
  return url.replace(/https:\/\/[^/]*s3[^/]*\.amazonaws\.com/, CDN);
}

/** v 파라미터로 캐시 버스팅 (updatedAt, contentHash 등 전달) */
export function withVersion(url: string, v?: string | number): string {
  if (!url || !v) return url;
  const u = new URL(url, 'https://dummy'); // 상대경로 방지용 베이스
  u.searchParams.set('v', String(v));
  return url.includes('://')
    ? `${u.protocol}//${u.host}${u.pathname}?${u.searchParams.toString()}`
    : `${u.pathname}?${u.searchParams.toString()}`;
}

export function toProxyUrl(src: string): string {
  try {
    const u = new URL(src);
    if (u.hostname === S3_HOST) {
      u.hostname = CF_HOST;
      return u.toString();
    }
    return src;
  } catch {
    // src가 절대 URL이 아니면 그대로 사용
    return src;
  }
}