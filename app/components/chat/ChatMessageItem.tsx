// =============================================
// File: app/components/chat/ChatMessageItem.tsx — 전체 코드 (교체용)
// =============================================
'use client';

import React, { useMemo } from 'react';
import type { ChatMessage } from '@/wiki/lib/chat-types';
import { useChat } from './ChatProvider';

/** 외부 아바타 URL을 헬멧 스타일 + 사이즈로 정규화 */
function normalizeAvatarUrl(url: string | null | undefined, size: number) {
  if (!url) return '';
  let u = url.trim();

  // http -> https 강제 (혼합 콘텐츠 예방)
  if (u.startsWith('http://')) u = 'https://' + u.slice('http://'.length);

  // minotar/crafthead: /avatar -> /helm
  u = u.replace(/(minotar\.net|crafthead\.net)\/avatar\//, '$1/helm/');

  // 경로 마지막 숫자(사이즈) 또는 png 확장자 처리
  // size 세그먼트가 있으면 png 확장자로 통일, 없으면 추가
  if (/(crafthead\.net|minotar\.net)\/helm\/[^/?]+\/\d+($|[/?])/.test(u)) {
    // 이미 /<size>가 있으면 .png 확장자 보장
    u = u.replace(/\/(\d+)(\/)?(\?.*)?$/, '/$1.png$2$3');
  } else if (/(crafthead\.net|minotar\.net)\/helm\/[^/?]+($|[/?])/.test(u)) {
    // size 세그먼트가 없다면 추가
    const sep = u.endsWith('/') ? '' : '/';
    u = `${u}${sep}${size}.png`;
  }

  // crafatar: overlay/size 파라미터 강제
  if (/crafatar\.com/.test(u)) {
    if (!/[?&]overlay\b/.test(u)) u += (u.includes('?') ? '&' : '?') + 'overlay';
    if (!/[?&]size=/.test(u)) u += (u.includes('?') ? '&' : '?') + `size=${size}`;
    u = u.replace(/([?&])size=\d+/g, `$1size=${size}`);
  }
  return u;
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
  const [srcs, setSrcs] = React.useState<string[]>([]);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const list: string[] = [];
    const n = minecraftName ? encodeURIComponent(minecraftName) : null;

    // 1) UUID 최우선: crafatar
    if (minecraftUUID) {
      list.push(`https://crafatar.com/avatars/${minecraftUUID}?overlay&size=${size}`);
    }

    // 2) 닉네임 기반 미러들 (PNG 확장자로 고정)
    if (n) {
      list.push(`https://crafthead.net/helm/${n}/${size}.png`);
      list.push(`https://minotar.net/helm/${n}/${size}.png`);
      // 보조 미러(선택): 안정성 향상
      list.push(`https://mc-heads.net/avatar/${n}/${size}.png`);
    }

    // 3) 서버 힌트 URL은 마지막 폴백으로
    const hint = normalizeAvatarUrl(avatarUrlHint, size);
    if (hint) list.push(hint);

    // 4) 최종 폴백(스티브 유사)
    list.push(`https://crafatar.com/avatars/94cf9511-c5d6-433a-b565-14010caac235?overlay&size=${size}`);

    setSrcs(list);
    setIdx(0);

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[MCHead] sources', { minecraftName, minecraftUUID, avatarUrlHint, list });
    }
  }, [minecraftName, minecraftUUID, avatarUrlHint, size]);

  const src = srcs[idx] ?? '';

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={minecraftName ? `${minecraftName} face` : 'MC face'}
      className={['rounded-full object-cover ring-1 ring-neutral-200', className].join(' ')}
      style={{ background: 'transparent' }}
      // ❌ 잠정 제거: 일부 CDN이 crossOrigin/no-referrer 조합을 싫어함
      // referrerPolicy="no-referrer"
      // crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setIdx(i => Math.min(i + 1, srcs.length - 1))}
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

  // 서버 스키마 변화 대응 -> user 구조 안전 추출
  const userObj = (m as any).user ?? {};
  const userId =
    toInt(userObj.id) ??
    toInt((m as any).user_id);

  // 닉네임: minecraft_name 우선 -> 없으면 일반 name
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

  // 표기 이름
  const displayName = useMemo(() => {
    const mc = minecraftName?.trim();
    if (mc) return mc;
    const nick = (userObj.name as string | undefined)?.trim();
    if (nick) return nick;
    return `user#${userId ?? '?'}`;
  }, [minecraftName, userObj, userId]);

  // 시간 라벨
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

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[ChatMessageItem] user/skin debug', {
      msgId: m.id,
      userId,
      minecraftName,
      minecraftUUIDRaw: minecraftUUID,
      avatarUrlHint,
      wholeUserObj: userObj,
    });
  }

  return (
    <div
      className={[
        'p-3 rounded-lg border',
        internalIsReplyToMe ? 'bg-blue-50 border-blue-300' : 'bg-white border-neutral-200',
      ].join(' ')}
    >
      {/* 헤더: [아바타] [닉네임] .......... [시간] */}
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
