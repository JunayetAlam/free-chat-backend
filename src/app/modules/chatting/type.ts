export interface Message {
  id: string;
  roomId: string;
  senderDeviceCode: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
}

export type WsEventType =
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'MESSAGE_SEND'
  | 'MESSAGE_EDIT'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_HISTORY'
  | 'ERROR';

export interface WsBaseEvent {
  event: WsEventType;
}

export interface WsRoomJoinEvent extends WsBaseEvent {
  event: 'ROOM_JOIN';
  payload: { roomId: string };
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

export type WsIncomingEvent =
  | WsRoomJoinEvent
  | WsMessageSendEvent
  | WsMessageEditEvent
  | WsMessageDeleteEvent;

export interface WsOutgoingEvent {
  event: WsEventType;
  payload: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}
