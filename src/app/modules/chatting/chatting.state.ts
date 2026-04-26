import { WebSocket } from 'ws';

export interface ChatClient {
  ws: WebSocket;
  deviceId: string;
  roomId: string | null;
}

export const clients: Map<WebSocket, ChatClient> = new Map();
export const roomSubscribers: Map<string, Set<WebSocket>> = new Map();
