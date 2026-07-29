export type WsEventType =
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'MESSAGE_SEND'
  | 'MESSAGE_EDIT'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_HISTORY'
  | 'CONVERSATION_LIST'
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

export type ConversationListItem = {
  roomId: string;
  name: string | null;
  inviteCode: string;
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
  | WsConversationListEvent;

export interface WsOutgoingEvent {
  event: WsEventType;
  payload: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}
