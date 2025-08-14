// C:\next\rdwiki\app\wiki\lib\ably.ts

import Ably from 'ably';
export const ablyRest = new Ably.Rest(process.env.ABLY_API_KEY!);
export const GLOBAL_CHANNEL = 'chat:global';
