import httpStatus from 'http-status';
import { randomBytes } from 'crypto';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { getClientIpFromRequest } from '../../utils/getClientIp';
import { upsertGuest } from '../../utils/upsertGuest';
import { logActivity } from '../../utils/activityLogger';
import { recordJoinedRoom } from '../../utils/recordJoinedRoom';
import {
  activeRecordFilter,
  softArchiveFields,
  softDeleteFields,
} from '../../utils/softDelete';
import {
  findAccessibleRoomByIdOrInvite,
  findActiveRoomByIdOrInvite,
  roomIdOrInviteWhere,
} from '../../utils/findRoom';

const generateInviteCode = () => randomBytes(6).toString('base64url').slice(0, 8);

const parseBoolQuery = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const assertActiveRoom = async (roomId: string) => {
  const room = await findActiveRoomByIdOrInvite(roomId);
  if (!room) {
    throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  }
  return room;
};

const assertRoomMember = async (roomId: string, guestId: string) => {
  const member = await prisma.roomMember.findFirst({
    where: {
      roomId,
      guestId,
      ...activeRecordFilter,
    },
  });
  if (!member) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not a member of this room');
  }
  return member;
};

const createRoom = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const ip = getClientIpFromRequest(req);
  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : undefined;

  const name =
    typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
  const displayName =
    typeof req.body?.displayName === 'string'
      ? req.body.displayName.trim()
      : req.guest.displayName || undefined;

  await upsertGuest({
    guestId: req.guest.id,
    displayName,
    ip,
    userAgent,
  });

  const room = await prisma.room.create({
    data: {
      name: name || undefined,
      inviteCode: generateInviteCode(),
      creatorGuestId: req.guest.id,
      creatorIp: ip,
      members: {
        create: {
          guestId: req.guest.id,
          displayName:
            displayName ||
            req.guest.displayName ||
            `Guest-${req.guest.id.slice(0, 6)}`,
          joinIp: ip,
          lastIp: ip,
          userAgent,
        },
      },
    },
  });

  await logActivity({
    action: 'ROOM_CREATE',
    roomId: room.id,
    guestId: req.guest.id,
    ip,
    userAgent,
    metadata: { inviteCode: room.inviteCode, name: room.name },
  });

  await recordJoinedRoom({
    roomId: room.id,
    guestId: req.guest.id,
    ip,
    userAgent,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room created successfully',
    data: room,
  });
});

const getRoomById = catchAsync(async (req, res) => {
  const { roomId } = req.params;

  // Include archived (not deleted) so archive list can open / delete rooms
  const room = await prisma.room.findFirst({
    where: {
      ...roomIdOrInviteWhere(roomId),
      isDeleted: false,
    },
    include: {
      members: {
        where: { isDeleted: false },
        select: {
          id: true,
          guestId: true,
          displayName: true,
          joinedAt: true,
          lastReadAt: true,
          leftAt: true,
        },
      },
    },
  });

  if (!room) {
    throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room fetched successfully',
    data: room,
  });
});

const getMyRooms = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const query: Record<string, unknown> = { ...req.query };

  // ?archiveData=true → archived list only; otherwise active (non-archived) list
  const archiveData = parseBoolQuery(query.archiveData) === true;
  delete query.archiveData;
  delete query.isArchived; // controlled below, not client-overridable for this endpoint
  delete query.isDeleted; // soft-deleted never returned (super-admin later)

  // Scope to rooms where this guest is a member
  query['members.some.guestId'] = req.guest.id;
  query['members.some.isDeleted'] = false;

  query.isDeleted = false; // globally hide soft-deleted rooms
  query.isArchived = archiveData; // true = archive list, false = active list

  const roomsQuery = new QueryBuilder(prisma.room, query);
  const result = await roomsQuery
    .search(['name', 'inviteCode'])
    .filter()
    .sort()
    .fields()
    .exclude()
    .paginate()
    .execute();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: archiveData
      ? 'Archived rooms retrieved successfully'
      : 'Rooms retrieved successfully',
    ...result,
  });
});

const getRoomMembers = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const { roomId: roomIdParam } = req.params;
  const room = await assertActiveRoom(roomIdParam);
  await assertRoomMember(room.id, req.guest.id);

  const query: Record<string, unknown> = { ...req.query };
  query.roomId = room.id;
  query.isDeleted = false;
  query.isArchived = false;

  const membersQuery = new QueryBuilder(prisma.roomMember, query);
  const result = await membersQuery
    .search(['displayName', 'guestId'])
    .filter()
    .sort()
    .fields()
    .exclude()
    .paginate()
    .execute();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room members retrieved successfully',
    ...result,
  });
});

const softDeleteRoom = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const { roomId } = req.params;
  // Allow deleting archived rooms (isArchived true), only block already-deleted
  const room = await findAccessibleRoomByIdOrInvite(roomId);

  if (!room) {
    throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  }

  if (room.creatorGuestId !== req.guest.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the creator can delete this room',
    );
  }

  const ip = getClientIpFromRequest(req);
  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : undefined;

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: softDeleteFields(req.guest.id),
  });

  await logActivity({
    action: 'ROOM_DELETE',
    roomId: room.id,
    guestId: req.guest.id,
    ip,
    userAgent,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room deleted successfully',
    data: updated,
  });
});

const archiveRoom = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const { roomId } = req.params;
  const room = await prisma.room.findFirst({
    where: { id: roomId, isDeleted: false, isArchived: false },
  });

  if (!room) {
    throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  }

  if (room.creatorGuestId !== req.guest.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the creator can archive this room',
    );
  }

  const ip = getClientIpFromRequest(req);
  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : undefined;

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: softArchiveFields(req.guest.id),
  });

  await logActivity({
    action: 'ROOM_ARCHIVE',
    roomId,
    guestId: req.guest.id,
    ip,
    userAgent,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room archived successfully',
    data: updated,
  });
});

export const RoomService = {
  createRoom,
  getRoomById,
  getMyRooms,
  getRoomMembers,
  softDeleteRoom,
  archiveRoom,
};
