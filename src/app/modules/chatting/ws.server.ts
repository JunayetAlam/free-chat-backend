import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { sendError, verifyGuestWsAuth } from './chatting.utils';
import { chattingValidation } from './chatting.validation';
import { chattingRequestValidation } from './chatting.validate.request';
import { clients, roomSubscribers } from './chatting.state';
import { eventHandlers } from './chatting.handler';
import { broadcast } from './chatting.broadcast';
import { prisma } from '../../utils/prisma';
import { logActivity } from '../../utils/activityLogger';
import { upsertGuest } from '../../utils/upsertGuest';

export const initWebSocketServer = (server: Server): void => {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const auth = verifyGuestWsAuth(req);
    if (!auth) {
      sendError(ws, 'Unauthorized: valid guest token and guestId required');
      ws.close(1008, 'Unauthorized');
      return;
    }

    await upsertGuest({
      guestId: auth.guestId,
      ip: auth.ip,
      userAgent: auth.userAgent,
    });

    clients.set(ws, {
      ws,
      guestId: auth.guestId,
      displayName: null,
      roomId: null,
      ip: auth.ip,
      userAgent: auth.userAgent,
    });

    ws.on('message', async raw => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
        console.log(parsed);
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

    ws.on('close', async () => {
      const client = clients.get(ws);
      if (client?.roomId) {
        roomSubscribers.get(client.roomId)?.delete(ws);

        try {
          await prisma.roomMember.updateMany({
            where: {
              roomId: client.roomId,
              guestId: client.guestId,
            },
            data: { leftAt: new Date() },
          });

          await logActivity({
            action: 'ROOM_LEAVE',
            roomId: client.roomId,
            guestId: client.guestId,
            ip: client.ip,
            userAgent: client.userAgent,
          });
        } catch (error) {
          console.error('[WS] leave cleanup failed', error);
        }

        broadcast(client.roomId, {
          event: 'ROOM_LEAVE',
          payload: {
            roomId: client.roomId,
            guestId: client.guestId,
            message: 'A user left the room',
          },
        });
      }
      clients.delete(ws);
    });

    ws.on('error', err =>
      console.error(`[WS Client Error] guestId=${auth.guestId}`, err.message),
    );
  });

  wss.on('error', err => console.error('[WSS Error]', err.message));
  console.log('[WS] WebSocket server initialized on path /ws');
};
