import httpStatus from 'http-status';

import sendResponse from '../../utils/sendResponse';

import catchAsync from '../../utils/catchAsync';
import { randomUUID } from 'crypto';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { messageStore } from '../chatting/chatting.message-store';
import { extractDeviceIdFromRequest } from '../chatting/chatting.utils';

const createRoom = catchAsync(async (req, res) => {
  const creatorDeviceId = extractDeviceIdFromRequest(req);

  const room = await prisma.room.create({
    data: {
      name: randomUUID(),
      creatorDeviceId,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room created successfully',
    data: room,
  });
});

const getRoomById = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room fetched successfully',
    data: room,
  });
});

const getAllRooms = catchAsync(async (req, res) => {
  const query = req.query;
  const requesterIp = req.ip;
  query.creatorIp = requesterIp;
  const roomQuery = new QueryBuilder(prisma.room, query);
  const result = await roomQuery
    .search(['name', 'creatorIp'])
    .sort()
    .paginate()
    .fields()
    .filter()
    .execute();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Rooms fetched successfully',
    ...result,
  });
});

const deleteRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const requesterDeviceId = extractDeviceIdFromRequest(req);
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new AppError(httpStatus.NOT_FOUND, 'Room not found');
  if (room.creatorDeviceId !== requesterDeviceId)
    throw new AppError(httpStatus.FORBIDDEN, 'Forbidden');

  await prisma.room.delete({ where: { id: roomId } });
  messageStore.deleteRoomMessages(roomId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Room deleted successfully',
    data: null,
  });
});

export const RoomService = {
  createRoom,
  getRoomById,
  getAllRooms,
  deleteRoom,
};
