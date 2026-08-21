import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import {
  getConversationsForGuest,
  send,
  sendError,
  sendRateLimitError,
  verifyGuestWsAuth,
} from './chatting.utils';
import { chattingValidation } from './chatting.validation';
import { chattingRequestValidation } from './chatting.validate.request';
import { clients } from './chatting.state';
import { eventHandlers } from './chatting.handler';
import { unfocusRoom } from './chatting.broadcast';
import {
  onGuestConnected,
  onGuestDisconnected,
} from './chatting.presence';
import { upsertGuest } from '../../utils/upsertGuest';
import { corsOrigins } from '../../../config';
import { getClientIpFromWs } from '../../utils/getClientIp';
import {
  checkWsAllEventsLimit,
  checkWsConnectionLimit,
  checkWsEventLimit,
} from './wsRateLimit';

export const initWebSocketServer = (server: Server): void => {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: (info, done) => {
      const { origin, req } = info;
      // Allow non-browser clients with no Origin; browsers must match list.
      if (origin && !corsOrigins.includes(origin)) {
        done(false, 403, 'Origin not allowed');
        return;
      }

      const ip = getClientIpFromWs(req) || 'unknown';
      const connLimit = checkWsConnectionLimit(ip);
      if (connLimit) {
        done(false, 429, connLimit.message);
        return;
      }

      done(true);
    },
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const auth = verifyGuestWsAuth(req);
    if (!auth) {
      sendError(ws, 'Unauthorized: valid guest token and guestId required');
      ws.close(1008, 'Unauthorized');
      return;
    }

    // Register client and message handler synchronously before any awaits
    // so messages sent immediately after connect are not missed.
    clients.set(ws, {
      ws,
      guestId: auth.guestId,
      displayName: null,
      roomId: null,
      joinEpoch: 0,
      tabVisible: true,
      ip: auth.ip,
      userAgent: auth.userAgent,
    });

    onGuestConnected(auth.guestId).catch(error => {
      console.error('[WS] presence connect notify failed', error);
    });

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

        const allLimit = checkWsAllEventsLimit(auth.guestId);
        if (allLimit) {
          sendRateLimitError(ws, allLimit);
          return;
        }

        const eventLimit = checkWsEventLimit(auth.guestId, event);
        if (eventLimit) {
          sendRateLimitError(ws, eventLimit);
          return;
        }

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

    // Run DB setup and initial conversation list in background after
    // the message handler is registered, so ROOM_JOIN is never missed.
    upsertGuest({
      guestId: auth.guestId,
      ip: auth.ip,
      userAgent: auth.userAgent,
    })
      .then(() => getConversationsForGuest(auth.guestId))
      .then(conversations => {
        send(ws, { event: 'CONVERSATION_LIST', payload: { conversations } });
      })
      .catch(error => {
        console.error('[WS] connection setup failed', error);
      });

    ws.on('close', async () => {
      const client = clients.get(ws);
      const guestId = client?.guestId ?? auth.guestId;

      if (client?.roomId) {
        await unfocusRoom(ws);
      }
      clients.delete(ws);

      try {
        await onGuestDisconnected(guestId);
      } catch (error) {
        console.error('[WS] presence disconnect notify failed', error);
      }
    });

    ws.on('error', err =>
      console.error(`[WS Client Error] guestId=${auth.guestId}`, err.message),
    );
  });

  wss.on('error', err => console.error('[WSS Error]', err.message));
  console.log('[WS] WebSocket server initialized on path /ws');
};
