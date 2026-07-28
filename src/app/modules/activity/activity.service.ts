import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { activeRecordFilter } from '../../utils/softDelete';
import { findActiveRoomByIdOrInvite } from '../../utils/findRoom';

const getAllActivityLogs = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const query: Record<string, unknown> = { ...req.query };
  query.isDeleted = false;

  const roomId =
    typeof req.query.roomId === 'string' ? req.query.roomId.trim() : '';

  if (roomId) {
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

    query.roomId = room.id;
  } else {
    // Without roomId, only return logs for this guest
    query.guestId = req.guest.id;
  }

  const logsQuery = new QueryBuilder(prisma.activityLog, query);
  const result = await logsQuery
    .search(['guestId', 'ip', 'messageId'])
    .filter()
    .sort()
    .fields()
    .exclude()
    .paginate()
    .execute();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Activity logs retrieved successfully',
    ...result,
  });
});

export const ActivityService = {
  getAllActivityLogs,
};
