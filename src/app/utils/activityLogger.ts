import { ActivityAction, Prisma } from '@prisma/client';
import { prisma } from './prisma';

type LogActivityInput = {
  action: ActivityAction;
  roomId?: string | null;
  messageId?: string | null;
  guestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export const logActivity = async (input: LogActivityInput) => {
  try {
    await prisma.activityLog.create({
      data: {
        action: input.action,
        roomId: input.roomId ?? undefined,
        messageId: input.messageId ?? undefined,
        guestId: input.guestId ?? undefined,
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error('[ActivityLog] failed to write log', error);
  }
};
