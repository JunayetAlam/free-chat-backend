import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { findAccessibleRoomByIdOrInvite } from '../../utils/findRoom';

const parseBoolQuery = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const getAllJoinedRooms = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const query: Record<string, unknown> = { ...req.query };
  const archiveData = parseBoolQuery(query.archiveData) === true;
  delete query.archiveData;
  delete query.isArchived;
  delete query.isDeleted;

  query.guestId = req.guest.id;
  query.isDeleted = false; // never return soft-deleted history
  query.isArchived = archiveData;
  // Hide history rows whose room was soft-deleted
  query['room.isDeleted'] = false;

  const joinedQuery = new QueryBuilder(prisma.joinedRoom, query);
  const result = await joinedQuery
    .search(['roomId', 'guestId', 'room.name', 'room.inviteCode'])
    .filter()
    .sort()
    .fields()
    .exclude()
    .paginate()
    .execute();

  // Attach room summary for each history row
  const rows = result.data as Array<{ roomId: string; [key: string]: unknown }>;
  const roomIds = [...new Set(rows.map(r => r.roomId))];
  const rooms =
    roomIds.length > 0
      ? await prisma.room.findMany({
          where: { id: { in: roomIds }, isDeleted: false },
        })
      : [];
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  const data = rows.map(row => ({
    ...row,
    room: roomMap.get(row.roomId) || null,
  }));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: archiveData
      ? 'Archived joined rooms retrieved successfully'
      : 'Joined rooms retrieved successfully',
    data,
    meta: result.meta,
  });
});

/** Soft-delete from this guest's room history (does not delete the Room) */
const softDeleteJoinedRoom = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const { roomId: roomIdParam } = req.params;
  const room = await findAccessibleRoomByIdOrInvite(roomIdParam);

  if (!room) {
    throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  }

  const joined = await prisma.joinedRoom.findFirst({
    where: {
      roomId: room.id,
      guestId: req.guest.id,
      isDeleted: false,
    },
  });

  if (!joined) {
    throw new AppError(httpStatus.NOT_FOUND, 'Joined room history not found');
  }

  const updated = await prisma.joinedRoom.update({
    where: { id: joined.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Removed from room history successfully',
    data: updated,
  });
});

/** Archive from this guest's room history (does not archive the Room) */
const archiveJoinedRoom = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const { roomId: roomIdParam } = req.params;
  const room = await findAccessibleRoomByIdOrInvite(roomIdParam);

  if (!room) {
    throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  }

  const joined = await prisma.joinedRoom.findFirst({
    where: {
      roomId: room.id,
      guestId: req.guest.id,
      isDeleted: false,
      isArchived: false,
    },
  });

  if (!joined) {
    throw new AppError(httpStatus.NOT_FOUND, 'Joined room history not found');
  }

  const updated = await prisma.joinedRoom.update({
    where: { id: joined.id },
    data: {
      isArchived: true,
      archivedAt: new Date(),
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Joined room archived successfully',
    data: updated,
  });
});

export const JoinedRoomService = {
  getAllJoinedRooms,
  softDeleteJoinedRoom,
  archiveJoinedRoom,
};
