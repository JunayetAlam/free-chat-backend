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
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from '../Upload/uploadToCloudinary';
import { notifyConversationUpdate } from '../chatting/chatting.utils';
import { isGuestOnline } from '../chatting/chatting.presence';
import {
  assertQuotaAvailable,
  QUOTA_MAX,
  roomQuotaPayload,
} from '../../utils/dailyQuota';

const generateInviteCode = () =>
  randomBytes(6).toString('base64url').slice(0, 8);

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
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not a member of this room',
    );
  }
  return member;
};

/** Owner-only for now; swap/extend later for roles or shared editors. */
const assertRoomOwner = (
  room: { creatorGuestId: string },
  guestId: string,
  action = 'edit this room',
) => {
  if (room.creatorGuestId !== guestId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Only the room owner can ${action}`,
    );
  }
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
          joinedAt: true,
          lastOpenedAt: true,
          leftAt: true,
          guest: {
            select: {
              displayName: true,
              profilePhoto: true,
            },
          },
        },
      },
    },
  });

  if (!room) {
    throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  }

  const roomWithLiveMembers = {
    ...room,
    members: room.members.map(member => {
      const liveName = member.guest?.displayName?.trim();
      return {
        id: member.id,
        guestId: member.guestId,
        displayName: liveName || `Guest-${member.guestId.slice(0, 6)}`,
        joinedAt: member.joinedAt,
        lastOpenedAt: member.lastOpenedAt,
        leftAt: member.leftAt,
        profilePhoto: member.guest?.profilePhoto ?? null,
      };
    }),
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room fetched successfully',
    data: roomWithLiveMembers,
    quota: roomQuotaPayload(room),
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

  // Scope to rooms this guest created (joined-only rooms live on /joined-rooms)
  query.creatorGuestId = req.guest.id;

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
    .search(['guest.displayName', 'guestId'])
    .filter()
    .sort()
    .fields()
    .exclude()
    .paginate()
    .execute();

  const data = Array.isArray(result.data)
    ? await (async () => {
        const members = result.data as Array<{
          guestId: string;
          [key: string]: unknown;
        }>;
        const guestIds = [...new Set(members.map(m => m.guestId))];
        const guests =
          guestIds.length === 0
            ? []
            : await prisma.guest.findMany({
                where: { id: { in: guestIds } },
                select: {
                  id: true,
                  displayName: true,
                  profilePhoto: true,
                },
              });
        const guestById = new Map(guests.map(g => [g.id, g]));

        return members.map(member => {
          const guest = guestById.get(member.guestId);
          const liveName = guest?.displayName?.trim();
          return {
            ...member,
            displayName: liveName || `Guest-${member.guestId.slice(0, 6)}`,
            profilePhoto: guest?.profilePhoto ?? null,
            isOnline: isGuestOnline(member.guestId),
          };
        });
      })()
    : result.data;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room members retrieved successfully',
    ...result,
    data,
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

  assertRoomOwner(room, req.guest.id, 'delete this room');

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

  assertRoomOwner(room, req.guest.id, 'archive this room');

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

const updateRoom = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const { roomId } = req.params;
  const room = await assertActiveRoom(roomId);
  assertRoomOwner(room, req.guest.id, 'edit this room');

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Room name is required');
  }

  const currentName = (room.name || '').trim();
  if (name === currentName) {
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'No room name change',
      data: room,
      quota: roomQuotaPayload(room),
    });
    return;
  }

  const bump = assertQuotaAvailable(
    room.nameChangeCount,
    room.nameChangeDay,
    QUOTA_MAX.roomName,
    `Daily room name limit reached (${QUOTA_MAX.roomName}/day). Try again after reset.`,
  );

  const ip = getClientIpFromRequest(req);
  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : undefined;

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: {
      name,
      nameChangeCount: bump.count,
      nameChangeDay: bump.day,
    },
  });

  await logActivity({
    action: 'ROOM_UPDATE',
    roomId: room.id,
    guestId: req.guest.id,
    ip,
    userAgent,
    metadata: { name },
  });

  await notifyConversationUpdate({
    roomId: room.id,
    patch: {
      name: updated.name ?? undefined,
      image: updated.image ?? undefined,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room updated successfully',
    data: updated,
    quota: roomQuotaPayload(updated),
  });
});

const updateRoomImage = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest required');
  }

  const { roomId } = req.params;
  const room = await assertActiveRoom(roomId);
  assertRoomOwner(room, req.guest.id, 'edit this room');

  const file = req.file;
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Please provide an image');
  }

  const bump = assertQuotaAvailable(
    room.imageChangeCount,
    room.imageChangeDay,
    QUOTA_MAX.roomImage,
    `Daily room image limit reached (${QUOTA_MAX.roomImage}/day). Try again after reset.`,
  );

  const previousImg = room.image || '';
  const uploaded = await uploadToCloudinary(file);
  if (!uploaded.Location) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to upload image');
  }

  const ip = getClientIpFromRequest(req);
  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : undefined;

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: {
      image: uploaded.Location,
      imageChangeCount: bump.count,
      imageChangeDay: bump.day,
    },
  });

  if (previousImg) {
    await deleteFromCloudinary(previousImg);
  }

  await logActivity({
    action: 'ROOM_UPDATE',
    roomId: room.id,
    guestId: req.guest.id,
    ip,
    userAgent,
    metadata: { imageUpdated: true },
  });

  await notifyConversationUpdate({
    roomId: room.id,
    patch: {
      name: updated.name ?? undefined,
      image: updated.image ?? undefined,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room image updated successfully',
    data: updated,
    quota: roomQuotaPayload(updated),
  });
});

export const RoomService = {
  createRoom,
  getRoomById,
  getMyRooms,
  getRoomMembers,
  updateRoom,
  updateRoomImage,
  softDeleteRoom,
  archiveRoom,
};
