import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { activeRecordFilter } from '../../utils/softDelete';
import { findActiveRoomByIdOrInvite } from '../../utils/findRoom';

const getAllMessages = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const roomId =
    typeof req.query.roomId === 'string' ? req.query.roomId.trim() : '';

  if (!roomId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'roomId query is required');
  }

  const room = await findActiveRoomByIdOrInvite(roomId);

  if (!room) {
    throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  }

  const membership = await prisma.roomMember.findFirst({
    where: {
      roomId: room.id,
      guestId: req.guest.id,
      ...activeRecordFilter,
    },
  });

  if (!membership) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not a member of this room',
    );
  }

  const query: Record<string, unknown> = { ...req.query };
  query.roomId = room.id;
  query.isDeleted = false;
  query.isArchived = false;

  const messagesQuery = new QueryBuilder(prisma.message, query);
  const result = await messagesQuery
    .search(['content', 'senderDisplayName', 'senderGuestId'])
    .filter()
    .sort()
    .fields()
    .exclude()
    .paginate()
    .execute();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Messages retrieved successfully',
    ...result,
  });
});

export const MessageService = {
  getAllMessages,
};
