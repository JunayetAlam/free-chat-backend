import { Request } from 'express';
import { IncomingMessage } from 'http';
import { ApiResponse } from './type';
import { prisma } from '../../utils/prisma';

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

export const findSingleRoom = async (id: string) => {
  return await prisma.room.findUniqueOrThrow({ where: { id } });
};
