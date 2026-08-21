import config from '../../../config';
import { prisma } from '../../utils/prisma';
import { sendPushNotificationSilent } from '../../utils/sendNotification';
import { isGuestAppVisible } from './chatting.presence';

const PREVIEW_MAX = 96;

const truncatePreview = (content: string) => {
  const trimmed = content.trim();
  if (trimmed.length <= PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, PREVIEW_MAX).trimEnd()}…`;
};

export const notifyRoomGuestsOfMessage = async ({
  senderGuestId,
  senderDisplayName,
  content,
  roomName,
  inviteCode,
  guestIds,
}: {
  senderGuestId: string;
  senderDisplayName: string;
  content: string;
  roomName: string | null;
  inviteCode: string;
  guestIds: Set<string>;
}): Promise<void> => {
  try {
    const recipientIds = [...guestIds].filter(
      guestId => guestId !== senderGuestId && !isGuestAppVisible(guestId),
    );

    if (recipientIds.length === 0) return;

    const guests = await prisma.guest.findMany({
      where: {
        id: { in: recipientIds },
        notificationsEnabled: true,
        isDeleted: false,
        fcmTokens: { some: {} },
      },
      select: {
        id: true,
        fcmTokens: {
          select: { token: true },
        },
      },
    });

    const title = roomName?.trim() || 'Flexi Chat';
    const body = `${senderDisplayName}: ${truncatePreview(content)}`;
    const path = `/room/${inviteCode}`;
    const clientBase = (config.base_url_client || '').replace(/\/$/, '');
    const link = clientBase ? `${clientBase}${path}` : undefined;

    await Promise.all(
      guests.flatMap(guest =>
        guest.fcmTokens.map((row: { token: string }) => {
          const token = row.token.trim();
          if (!token) return Promise.resolve();
          return sendPushNotificationSilent({
            guestId: guest.id,
            token,
            title,
            body,
            link,
            data: {
              path,
              inviteCode,
              guestId: guest.id,
            },
          });
        }),
      ),
    );
  } catch (error) {
    console.log('🔥 Push batch error:', error);
  }
};
