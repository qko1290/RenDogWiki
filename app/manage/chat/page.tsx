// =============================================
// File: app/manage/chat/page.tsx
// (동작에는 문제 없어서 최소 변경: 그대로 사용해도 됩니다)
// =============================================
'use client';

import ChatProvider from '@/app/components/chat/ChatProvider';
import WikiHeader from '@/components/common/Header';
import ChatPanel from '@/app/components/chat/ChatPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import '@/wiki/css/chat.css';

type UserInfo = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
  role?: string;
};

export default function ChatPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [uuid, setUuid] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  // (선택) 화면 진입 시 사용자 정보를 가져와 Header로 넘겨줍니다.
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!r.ok) { if (!aborted) setUser(null); return; }
        const j = await r.json();
        if (!aborted && j?.user) setUser(j.user as UserInfo);
      } catch {
        if (!aborted) setUser(null);
      }
    })();
    return () => { aborted = true; };
  }, []);

  useEffect(() => {
    if (!user?.minecraft_name) return;
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/mojang/uuid?name=${encodeURIComponent(user.minecraft_name)}`,
          { signal: ac.signal }
        );
        if (!r.ok) { setUuid(null); return; }
        const j = await r.json();
        if (!ac.signal.aborted) setUuid(j.uuid);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setUuid(null);
      }
    })();
    return () => ac.abort();
  }, [user?.minecraft_name]);

  const avatarUrl = useMemo(() => {
    const base = 'https://crafatar.com/avatars';
    return `${base}/${uuid ?? user?.minecraft_name}?overlay`;
  }, [uuid, user?.minecraft_name]);

  return (
    <ChatProvider>
      <div className="chat-page">
        <div ref={headerRef} className="chat-page__header">
          {/* Header는 그대로 user를 받습니다(없어도 동작) */}
          <WikiHeader user={user} />
        </div>
        <main className="chat-page__main">
          <div className="chat-page__inner">
            <ChatPanel />
          </div>
        </main>
      </div>
    </ChatProvider>
  );
}
