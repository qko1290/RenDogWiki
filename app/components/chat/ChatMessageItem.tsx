// =============================================
// File: app/components/chat/ChatMessageItem.tsx — 전체 코드 (교체용)
// =============================================
'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '@/wiki/lib/chat-types';
import { useChat } from './ChatProvider';
import '@/wiki/css/chat.css';

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
  minecraftName, minecraftUUID, avatarUrlHint, size = 24, className = '',
}: {
  minecraftName?: string | null;
  minecraftUUID?: string | null;
  avatarUrlHint?: string | null;
  size?: number;
  className?: string;
}) {
  const initialSrcs = useMemo(() => {
    const list: string[] = [];
    const n = minecraftName ? encodeURIComponent(minecraftName) : null;
    const keyHint = (minecraftUUID || minecraftName || avatarUrlHint || 'anon') as string;
    if (minecraftUUID) list.push(`https://crafatar.com/avatars/${minecraftUUID}?overlay&size=${size}`);
    if (n) {
      list.push(`https://crafthead.net/helm/${n}/${size}.png`);
      list.push(`https://minotar.net/helm/${n}/${size}.png`);
      list.push(`https://mc-heads.net/avatar/${n}/${size}.png`);
    }
    const hint = normalizeAvatarUrl(avatarUrlHint, size);
    if (hint) list.push(hint);
    list.push(`https://crafatar.com/avatars/94cf9511-c5d6-433a-b565-14010caac235?overlay&size=${size}`);
    return list.map((raw) => toProxy(raw, keyHint));
  }, [minecraftName, minecraftUUID, avatarUrlHint, size]);

  const [srcs, setSrcs] = useState<string[]>(initialSrcs);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setSrcs(initialSrcs); setIdx(0); }, [initialSrcs]);
  const src = srcs[idx] ?? '';

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={minecraftName ? `${minecraftName} face` : 'MC face'}
      className={['chat-avatar', className].join(' ')}
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

/** 답장 타겟 */
function useReplyTarget(replyToId: number | null | undefined) {
  const { getMessageById } = useChat();
  const target = useMemo(() => {
    if (!replyToId) return null;
    return getMessageById?.(replyToId) ?? null;
  }, [getMessageById, replyToId]);
  return target as (ChatMessage | null);
}

function scrollToMessage(id: number) {
  const el = document.getElementById(`chat-msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('chat-jump'); // 재적용을 위해 리셋
  // @ts-ignore
  void el.offsetWidth;
  el.classList.add('chat-jump');
}

type Props = {
  m: ChatMessage;
  isReplyToMe?: boolean;
  onReply?: (m: ChatMessage | null) => void;
};

export default function ChatMessageItem({ m, isReplyToMe, onReply }: Props) {
  const { toggleReaction, setReplyingTo } = useChat();

  // --- 컨텍스트 메뉴 상태 ---
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{x: number; y: number}>({x: 0, y: 0});
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 바깥 클릭/ESC로 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return setMenuOpen(false);
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const onContextMenu: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    // 화면 밖으로 삐져나가지 않게 살짝 보정
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.min(e.clientX, vw - 200 - pad);
    const y = Math.min(e.clientY, vh - 160 - pad);
    setMenuPos({ x, y });
    setMenuOpen(true);
  };

  // 서버 스키마 변화 대응 -> user 구조 안전 추출
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
    try { return new Date(m.created_at).toLocaleString(); }
    catch { return String(m.created_at); }
  }, [m.created_at]);

  const likeCount = (m as any).like_count ?? 0;
  const dislikeCount = (m as any).dislike_count ?? 0;
  const iLiked = Boolean((m as any).i_liked);
  const iDisliked = Boolean((m as any).i_disliked);

  // 답장 대상 미리보기
  const replyTarget = useReplyTarget((m as any).reply_to_id ?? null);
  const targetUser = (replyTarget as any)?.user ?? {};
  const targetName =
    (targetUser?.minecraft_name as string | undefined) ??
    (targetUser?.name as string | undefined) ??
    ((replyTarget as any)?.minecraft_name as string | undefined) ??
    ((replyTarget as any)?.user_name as string | undefined) ??
    (replyTarget ? `user#${(replyTarget as any)?.user_id ?? (targetUser?.id ?? '?')}` : '');
  const targetUUID: string | undefined =
    (targetUser?.minecraft_uuid as string | undefined) ??
    ((replyTarget as any)?.minecraft_uuid as string | undefined);
  const targetAvatarHint: string | undefined =
    (targetUser?.avatar_url as string | undefined) ??
    ((replyTarget as any)?.avatar_url as string | undefined);

  const targetSnippet = useMemo(() => {
    const text = (replyTarget as any)?.text as string | undefined;
    if (!text) return '';
    const oneLine = text.replace(/\s+/g, ' ').trim();
    return oneLine.length > 60 ? oneLine.slice(0, 57) + '…' : oneLine;
  }, [replyTarget]);

  const doReply = () => { setReplyingTo(m); setMenuOpen(false); };
  const doLike = async () => { await toggleReaction(m.id, 'like'); setMenuOpen(false); };
  const doDislike = async () => { await toggleReaction(m.id, 'dislike'); setMenuOpen(false); };

  return (
    <div id={`chat-msg-${m.id}`} className="chat-item" data-message-id={m.id} onContextMenu={onContextMenu}>
      {/* ① 답장 미리보기: 오른쪽으로 이동 + 컴팩트 */}
      {(m as any).reply_to_id && replyTarget ? (
        <button
          type="button"
          onClick={() => scrollToMessage((replyTarget as any).id)}
          className="chat-reply chat-reply--indented"
          title={`원문으로 이동 (#${(replyTarget as any).id})`}
        >
          <div className="chat-reply-pill chat-reply-pill--compact">
            <MCHead
              minecraftName={targetName}
              minecraftUUID={targetUUID}
              avatarUrlHint={targetAvatarHint}
              size={18}
              className="chat-reply-avatar"
            />
            <span className="chat-reply__name">{targetName || '알 수 없음'}</span>
            {targetSnippet ? <span className="chat-reply__snippet">· {targetSnippet}</span> : null}
          </div>
        </button>
      ) : null}

      {/* ② 헤더 (버튼 그룹 제거) */}
      <div className="chat-header">
        <MCHead
          minecraftName={minecraftName}
          minecraftUUID={minecraftUUID}
          avatarUrlHint={avatarUrlHint}
          size={28}
          className="chat-avatar"
        />
        <div className="chat-name">{displayName}</div>
        <div className="chat-time">{timeLabel}</div>
      </div>

      {/* ③ 본문 */}
      <div className="chat-text">{m.text}</div>

      {/* ④ 컨텍스트 메뉴 (우클릭) */}
      {menuOpen && (
        <>
          <div className="chat-menu-overlay" />
          <div
            ref={menuRef}
            className="chat-menu"
            style={{ left: `${menuPos.x}px`, top: `${menuPos.y}px` }}
          >
            <div className="chat-menu__item" onClick={doReply}>
              <span className="chat-menu__icon">💬</span>
              <span>답장</span>
              <span className="chat-menu__kbd">R</span>
            </div>
            <div className="chat-menu__item" onClick={doLike}>
              <span className="chat-menu__icon">👍</span>
              <span>좋아요</span>
              <span className="chat-menu__kbd">{likeCount}</span>
            </div>
            <div className="chat-menu__item" onClick={doDislike}>
              <span className="chat-menu__icon">👎</span>
              <span>싫어요</span>
              <span className="chat-menu__kbd">{dislikeCount}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
