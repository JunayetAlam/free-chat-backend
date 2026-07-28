import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import cookieParser from 'cookie';
import { Secret } from 'jsonwebtoken';
import { ApiResponse, WsOutgoingEvent } from './type';
import { verifyToken } from '../../utils/verifyToken';
import config from '../../../config';
import { getClientIpFromWs } from '../../utils/getClientIp';
import { findActiveRoomByIdOrInvite } from '../../utils/findRoom';

export const buildResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
): ApiResponse<T> => ({
  success,
  message,
  ...(data !== undefined && { data }),
});

export const findActiveRoom = async (idOrCode: string) => {
  return findActiveRoomByIdOrInvite(idOrCode);
};

export const send = (ws: WebSocket, event: WsOutgoingEvent): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
};

export const sendError = (ws: WebSocket, message: string): void => {
  send(ws, { event: 'ERROR', payload: { message } });
};

const getCookies = (req: IncomingMessage) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {} as Record<string, string>;
  const cookies = cookieParser.parseCookie(cookieHeader);
  return cookies;
};

export const extractGuestTokenFromWs = (
  req: IncomingMessage,
): string | null => {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const fromQuery = url.searchParams.get('token');
    if (fromQuery) return fromQuery.trim();
  } catch {
    // ignore
  }

  const cookies = getCookies(req);
  return cookies.token || cookies.refreshToken || null;
};

/**
 * Auth via cookies (preferred) or query token.
 * guestId comes from JWT; cookie guestId must match when present.
 */
export const verifyGuestWsAuth = (
  req: IncomingMessage,
): { guestId: string; ip?: string; userAgent?: string } | null => {
  const cookies = getCookies(req);
  console.log(cookies);
  const cookieGuestId = cookies.guestId?.trim() || null;

  const token = extractGuestTokenFromWs(req);
  if (!token) return null;

  const tryDecode = (tok: string, secret: Secret) => {
    const decoded = verifyToken(tok, secret);
    return (decoded.guestId as string) || null;
  };

  let tokenGuestId: string | null = null;
  try {
    tokenGuestId = tryDecode(token, config.jwt.access_secret as Secret);
  } catch {
    try {
      tokenGuestId = tryDecode(
        cookies.refreshToken || token,
        config.jwt.refresh_secret as Secret,
      );
    } catch {
      return null;
    }
  }

  if (!tokenGuestId) return null;

  if (cookieGuestId && cookieGuestId !== tokenGuestId) return null;

  return {
    guestId: tokenGuestId,
    ip: getClientIpFromWs(req),
    userAgent:
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined,
  };
};
