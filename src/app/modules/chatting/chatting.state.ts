import { WebSocket } from 'ws';

export interface ChatClient {
  ws: WebSocket;
  guestId: string;
  displayName: string | null;
  roomId: string | null;
  /** Bumped on every ROOM_JOIN so overlapping joins discard stale work. */
  joinEpoch: number;
  ip?: string;
  userAgent?: string;
}

export const clients: Map<WebSocket, ChatClient> = new Map();
export const roomSubscribers: Map<string, Set<WebSocket>> = new Map();
