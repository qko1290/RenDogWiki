// =============================================
// File: app/wiki/lib/chat-types.ts
// =============================================
/**
 * 채팅 도메인 타입 정의 모음.
 * - UI/클라이언트 상태, SSE/WebSocket 이벤트 스트림, REST 응답 등에 공용 사용.
 * - 런타임 로직 없음(타입 전용). 공개 인터페이스(필드명/유형) 유지가 최우선.
 */

export type ChatUser = {
  /** 내부 사용자 ID */
  id: number;
  /** 표시 이름(닉네임) */
  name: string;
  /** 아바타 이미지 URL(없을 수 있음) */
  avatar_url?: string | null;
};

export type ChatMessage = {
  /** 채팅 메시지 ID */
  id: number;
  /** 작성자 */
  user: ChatUser;
  /** 본문 텍스트(서버 저장 기준의 가공된 문자열) */
  text: string;
  /** 답글 대상 메시지 ID(null이면 일반 메시지) */
  reply_to_id: number | null;

  /** 공감 수 */
  like_count: number;
  /** 비공감 수 */
  dislike_count: number;

  /** 내가 공감했는지(선택적, 세션/요청 맥락에 따라 포함될 수 있음) */
  i_liked?: boolean;
  /** 내가 비공감했는지(선택적, 세션/요청 맥락에 따라 포함될 수 있음) */
  i_disliked?: boolean;

  /** ISO8601 문자열(예: "2024-03-01T12:34:56.000Z") */
  created_at: string;

  /** 내가 작성한 메시지에 달린 답글 여부(목록 화면에서 강조 등에 사용, 선택적) */
  reply_to_me?: boolean;
};

/** 리액션 종류(서버/클라이언트 공용) */
export type ReactionKind = 'like' | 'dislike';

/** 채팅 이벤트 종류(스트림) */
export type ChatEventKind =
  | 'message.created'
  | 'message.edited'
  | 'message.deleted'
  | 'reaction.changed';

/**
 * 이벤트 단위(구독/SSE/WebSocket)
 * - kind: 이벤트 종류
 * - message: 이벤트 적용 결과의 최신 메시지 스냅샷
 */
export type ChatEvent = { kind: ChatEventKind; message: ChatMessage };
