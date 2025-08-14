// C:\next\rdwiki\app\wiki\lib\chat-realtime.ts

import Ably from 'ably';
import type { ChatEvent } from '@/wiki/lib/chat-types';

const ABLY_KEY = process.env.ABLY_API_KEY || process.env.ABLY_SERVER_API_KEY;
if (!ABLY_KEY) {
  console.warn('[chat] ABLY_API_KEY 미설정 – 서버 publish 비활성화');
}

export async function publishChat(event: ChatEvent) {
  if (!ABLY_KEY) return;
  // 타입 이슈 회피 (ably d.ts 버전차)
  const rest: any = new (Ably as any).Rest(ABLY_KEY);
  const ch: any = rest.channels.get('rdwiki-chat');
  await ch.publish('chat', event); // 클라에서는 이벤트명 무시하고 data만 사용
}
