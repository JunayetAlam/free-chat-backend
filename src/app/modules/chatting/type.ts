export type WsEventType =
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'MESSAGE_SEND'
  | 'MESSAGE_EDIT'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_HISTORY'
  | 'MESSAGE_HISTORY_MORE'
  | 'CONVERSATION_LIST'
  | 'CONVERSATION_UPDATE'
  | 'PRESENCE_UPDATE'
  | 'PRESENCE_SNAPSHOT'
  | 'ERROR';

export interface WsBaseEvent {
  event: WsEventType;
}

export interface WsRoomJoinEvent extends WsBaseEvent {
  event: 'ROOM_JOIN';
  payload: { roomId: string; displayName?: string };
}

export interface WsMessageSendEvent extends WsBaseEvent {
  event: 'MESSAGE_SEND';
  payload: { roomId: string; content: string };
}

export interface WsMessageEditEvent extends WsBaseEvent {
  event: 'MESSAGE_EDIT';
  payload: { roomId: string; messageId: string; content: string };
}

export interface WsMessageDeleteEvent extends WsBaseEvent {
  event: 'MESSAGE_DELETE';
  payload: { roomId: string; messageId: string };
}

export interface WsConversationListEvent extends WsBaseEvent {
  event: 'CONVERSATION_LIST';
  payload: Record<string, never>;
}

export interface WsMessageHistoryMoreEvent extends WsBaseEvent {
  event: 'MESSAGE_HISTORY_MORE';
  payload: { roomId: string; beforeMessageId: string };
}

export type ConversationListItem = {
  roomId: string;
  name: string | null;
  image: string | null;
  inviteCode: string;
  creatorGuestId: string;
  firstJoinedAt: Date;
  lastJoinedAt: Date;
  lastMessage: {
    content: string;
    createdAt: Date;
    senderDisplayName: string;
  } | null;
};

export type WsIncomingEvent =
  | WsRoomJoinEvent
  | WsMessageSendEvent
  | WsMessageEditEvent
  | WsMessageDeleteEvent
  | WsConversationListEvent
  | WsMessageHistoryMoreEvent;

export interface WsOutgoingEvent {
  event: WsEventType;
  payload: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}
