import { Request } from 'express';
import { IncomingMessage } from 'http';
import { ApiResponse, WsOutgoingEvent } from './type';
import { prisma } from '../../utils/prisma';
import { WebSocket } from 'ws';

export const extractIpFromRequest = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
};

export const extractIpFromWs = (req: IncomingMessage): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
};

export const buildResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
): ApiResponse<T> => ({
  success,
  message,
  ...(data !== undefined && { data }),
});

export const findSingleRoom = async (id: string, ws: WebSocket) => {
  const data = await prisma.room.findUnique({ where: { id } });

  if (!data) sendError(ws, 'Room not found');
  return data;
};

export const send = (ws: WebSocket, event: WsOutgoingEvent): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
};

export const sendError = (ws: WebSocket, message: string): void => {
  send(ws, { event: 'ERROR', payload: { message } });
};
