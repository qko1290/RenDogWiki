// =============================================
// File: app/components/chat/ChatMessageItem.tsx — 전체 코드 (교체용)
// =============================================
'use client';

import React, { useMemo } from 'react';
import type { ChatMessage } from '@/wiki/lib/chat-types';
import { useChat } from './ChatProvider';

const DEPLOY_V = process.env.NEXT_PUBLIC_DEPLOY_COMMIT || 'dev';

/** 외부 아바타 URL을 헬멧 스타일 + 사이즈로 정규화 */
function normalizeAvatarUrl(url: string | null | undefined, size: number) {
  if (!url) return '';
  let u = url.trim();

  if (u.startsWith('http://')) u = 'https://' + u.slice('http://'.length);
  u = u.replace(/(minotar\.net|crafthead\.net)\/avatar\//, '$1/helm/');

  if (/(crafthead\.net|minotar\.net)\/helm\/[^/?]+\/\d+($|[/?])/.test(u)) {
    u = u.replace(/\/(\d+)(\/)?(\?.*)?$/, '/$1.png$2$3');
  } else if (/(crafthead\.net|minotar\.net)\/helm\/[^/?]+($|[/?])/.test(u)) {
    const sep = u.endsWith('/') ? '' : '/';
    u = `${u}${sep}${size}.png`;
  }

  if (/crafatar\.com/.test(u)) {
    if (!/[?&]overlay\b/.test(u)) u += (u.includes('?') ? '&' : '?') + 'overlay';
    if (!/[?&]size=/.test(u)) u += (u.includes('?') ? '&' : '?') + `size=${size}`;
    u = u.replace(/([?&])size=\d+/g, `$1size=${size}`);
  }
  return u;
}

/** 동일 출처 프록시 + 배포/유저 단위 캐시 버스터 */
function toProxy(raw: string, keyHint: string) {
  if (!raw) return '';
  const u = encodeURIComponent(raw);
  const k = encodeURIComponent(keyHint || 'u');
  return `/api/proxy/avatar?u=${u}&v=${DEPLOY_V}&k=${k}`;
}

/** 작은 원형 MC 헤드 이미지(다중 소스 폴백) */
function MCHead({
  minecraftName,
  minecraftUUID,
  avatarUrlHint,
  size = 32,
  className = '',
}: {
  minecraftName?: string | null;
  minecraftUUID?: string | null;
  avatarUrlHint?: string | null;
  size?: number;
  className?: string;
}) {
  // 1) 렌더 시점에 "바로" 사용할 수 있는 후보 리스트를 먼저 만든다.
  const initialSrcs = useMemo(() => {
    const list: string[] = [];
    const n = minecraftName ? encodeURIComponent(minecraftName) : null;
    const keyHint = (minecraftUUID || minecraftName || avatarUrlHint || 'anon') as string;

    if (minecraftUUID) {
      list.push(`https://crafatar.com/avatars/${minecraftUUID}?overlay&size=${size}`);
    }
    if (n) {
      list.push(`https://crafthead.net/helm/${n}/${size}.png`);
      list.push(`https://minotar.net/helm/${n}/${size}.png`);
      list.push(`https://mc-heads.net/avatar/${n}/${size}.png`);
    }
    const hint = normalizeAvatarUrl(avatarUrlHint, size);
    if (hint) list.push(hint);
    list.push(`https://crafatar.com/avatars/94cf9511-c5d6-433a-b565-14010caac235?overlay&size=${size}`);

    // 동일 출처 프록시로 즉시 변환
    return list.map((raw) => toProxy(raw, keyHint));
  }, [minecraftName, minecraftUUID, avatarUrlHint, size]);

  // 2) 초깃값을 동기 주입 → 첫 페인트부터 src가 채워진다.
  const [srcs, setSrcs] = React.useState<string[]>(initialSrcs);
  const [idx, setIdx] = React.useState(0);

  // 3) 의존성 변경 시에만 후보군 갱신(보조)
  React.useEffect(() => {
    setSrcs(initialSrcs);
    setIdx(0);
  }, [initialSrcs]);

  const src = srcs[idx] ?? '';

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={minecraftName ? `${minecraftName} face` : 'MC face'}
      className={['rounded-full object-cover ring-1 ring-neutral-200', className].join(' ')}
      style={{ background: 'transparent' }}
      // 새로고침에서도 즉시 요청되도록 lazy 미사용
      decoding="async"
      draggable={false}
      onLoad={(e) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[MCHead] onLoad', { idx, src: (e.target as HTMLImageElement).src });
        }
      }}
      onError={() => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[MCHead] onError', { idx, src });
        }
        setIdx(i => Math.min(i + 1, srcs.length - 1));
      }}
      title={minecraftName ?? undefined}
    />
  );
}

// 숫자 비슷한 문자열을 안전하게 정수로
function toInt(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return Math.trunc(val);
  if (typeof val === 'string' && /^\d+$/.test(val)) return Number(val);
  return null;
}

type Props = {
  m: ChatMessage;
  isReplyToMe?: boolean;
  onReply?: (m: ChatMessage | null) => void;
};

export default function ChatMessageItem({ m, isReplyToMe, onReply }: Props) {
  const { toggleReaction, setReplyingTo } = useChat();

  const userObj = (m as any).user ?? {};
  const userId =
    toInt(userObj.id) ??
    toInt((m as any).user_id);

  const minecraftName: string | undefined =
    (userObj.minecraft_name as string | undefined) ??
    ((m as any).minecraft_name as string | undefined) ??
    (userObj.name as string | undefined);

  const minecraftUUID: string | undefined =
    (userObj.minecraft_uuid as string | undefined) ??
    ((m as any).minecraft_uuid as string | undefined);

  const avatarUrlHint: string | undefined =
    (userObj.avatar_url as string | undefined) ??
    ((m as any).avatar_url as string | undefined);

  const displayName = useMemo(() => {
    const mc = minecraftName?.trim();
    if (mc) return mc;
    const nick = (userObj.name as string | undefined)?.trim();
    if (nick) return nick;
    return `user#${userId ?? '?'}`;
  }, [minecraftName, userObj, userId]);

  const timeLabel = useMemo(() => {
    try {
      return new Date(m.created_at).toLocaleString();
    } catch {
      return String(m.created_at);
    }
  }, [m.created_at]);

  const internalIsReplyToMe =
    typeof isReplyToMe === 'boolean'
      ? isReplyToMe
      : Boolean((m as any).reply_to_me);

  const likeCount = (m as any).like_count ?? 0;
  const dislikeCount = (m as any).dislike_count ?? 0;
  const iLiked = Boolean((m as any).i_liked);
  const iDisliked = Boolean((m as any).i_disliked);

  return (
    <div
      className={[
        'p-3 rounded-lg border',
        internalIsReplyToMe ? 'bg-blue-50 border-blue-300' : 'bg-white border-neutral-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <MCHead
          minecraftName={minecraftName}
          minecraftUUID={minecraftUUID}
          avatarUrlHint={avatarUrlHint}
          size={32}
          className="shrink-0"
        />
        <div className="font-medium text-neutral-800">{displayName}</div>
        <div className="ml-auto text-xs text-neutral-400">{timeLabel}</div>
      </div>

      {m.reply_to_id ? (
        <div className="inline-flex items-center gap-2 text-xs text-neutral-500 mt-1">
          <span className="px-2 py-0.5 bg-neutral-100 rounded-md">reply to #{m.reply_to_id}</span>
        </div>
      ) : null}

      <div className="mt-1 whitespace-pre-wrap break-words text-neutral-900">{m.text}</div>

      <div className="mt-2 flex items-center gap-2">
        <button
          className="px-2 py-1 text-xs rounded-md border border-neutral-200 hover:bg-neutral-50"
          onClick={() => (onReply ? onReply(m) : setReplyingTo(m))}
          aria-label="답장"
          type="button"
        >
          답장
        </button>
        <button
          className={[
            'px-2 py-1 text-xs rounded-md border border-neutral-200 hover:bg-neutral-50',
            iLiked ? 'bg-neutral-100' : '',
          ].join(' ')}
          onClick={() => toggleReaction(m.id, 'like')}
          title="좋아요"
          aria-pressed={iLiked}
          type="button"
        >
          👍 <span className="ml-1">{likeCount}</span>
        </button>
        <button
          className={[
            'px-2 py-1 text-xs rounded-md border border-neutral-200 hover:bg-neutral-50',
            iDisliked ? 'bg-neutral-100' : '',
          ].join(' ')}
          onClick={() => toggleReaction(m.id, 'dislike')}
          title="싫어요"
          aria-pressed={iDisliked}
          type="button"
        >
          👎 <span className="ml-1">{dislikeCount}</span>
        </button>
      </div>
    </div>
  );
}
