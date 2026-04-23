import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { sendError } from './chatting.utils';
import { extractIpFromWs } from './chatting.utils';
import { chattingValidation } from './chatting.validation';
import { chattingRequestValidation } from './chatting.validate.request';
import { clients, roomSubscribers } from './chatting.state';
import { eventHandlers } from './chatting.handler';
import { broadcast } from './chatting.broadcast';

export const initWebSocketServer = (server: Server): void => {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = extractIpFromWs(req);
    clients.set(ws, { ws, ip, roomId: null });

    ws.on('message', async raw => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        sendError(ws, 'Invalid JSON format');
        return;
      }

      const eventParsed = await chattingRequestValidation(
        chattingValidation.wsEventSchema,
        parsed,
        sendError,
        ws,
      );

      if (eventParsed) {
        const { event, payload } = eventParsed;
        const handler = eventHandlers[event];

        if (!handler) {
          sendError(ws, `Unknown event: ${event}`);
          return;
        }

        try {
          await handler(ws, payload);
        } catch (err) {
          console.error(`[WS Error] event=${event}`, err);
          sendError(ws, 'An unexpected error occurred');
        }
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client?.roomId) {
        roomSubscribers.get(client.roomId)?.delete(ws);
        broadcast(client.roomId, {
          event: 'ROOM_LEAVE',
          payload: { roomId: client.roomId, message: 'A user left the room' },
        });
      }
      clients.delete(ws);
    });

    ws.on('error', err =>
      console.error(`[WS Client Error] ip=${ip}`, err.message),
    );
  });

  wss.on('error', err => console.error('[WSS Error]', err.message));
  console.log('[WS] WebSocket server initialized on path /ws');
};
