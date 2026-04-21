import httpStatus from 'http-status';
import { NotificationType } from '@prisma/client';
import QueryBuilder from '../../builder/QueryBuilder';
import { getSocket } from '../../utils/socket';
import { prisma } from '../../utils/prisma';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';

const createNotification = catchAsync(async (req, res) => {
  const { title, message, type, userIds, redirectEndpoint } = req.body;

  const io = getSocket();

  const notification = await prisma.notification.create({
    data: {
      title,
      message,
      type,
      redirectEndpoint: redirectEndpoint || ''
    },
  });

  if (userIds.length > 0) {
    const NotificationUsers = userIds.map((userId: string) => ({
      notificationId: notification.id,
      userId,
    }));

    await prisma.notificationUser.createMany({
      data: NotificationUsers,
    });

    userIds.forEach((id: string) => {
      io.to(id).emit('notification', {
        ...notification,
        isRead: false,
      });
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Notification created successfully',
    data: notification,
  });
});

const getAllNotifications = catchAsync(async (req, res) => {
  const query = req.query;
  query.userId = req.user.id;

  const notificationQuery = new QueryBuilder(
    prisma.notificationUser,
    query,
  );
  const result = await notificationQuery
    .search(['name'])
    .filter()
    .sort()
    .exclude()
    .paginate()
    .customFields({
      id: true,
      isRead: true,
      notificationId: true,
      createdAt: true,
      notification: {
        select: {
          id: true,
          message: true,
          createdAt: true,
          title: true,
          type: true,
          redirectEndpoint: true
        }
      },
      receivedAt: true,
      updatedAt: true,
      userId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true
        }
      }
    })
    .execute();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Notifications retrieved successfully',
    data: result,
  });
});

const getUsersByNotification = catchAsync(async (req, res) => {
  const { notificationId } = req.params;

  const users = await prisma.notificationUser.findMany({
    where: {
      notificationId: notificationId,
    },
    include: {
      user: true,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Users by notification retrieved successfully',
    data: users.map(recipient => recipient.user),
  });
});

const markNotificationAsRead = catchAsync(async (req, res) => {
  const { notificationId } = req.params;

  const updatedRecipient = await prisma.notificationUser.updateMany({
    where: {
      notificationId: notificationId,
      userId: req.user.id,
    },
    data: {
      isRead: true,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Notification marked as read successfully',
    data: updatedRecipient,
  });
});

const getUnreadNotificationCount = catchAsync(async (req, res) => {
  const count = await prisma.notificationUser.count({
    where: {
      userId: req.user.id,
      isRead: false,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Unread notification count retrieved successfully',
    data: count,
  });
});

const markAllNotificationsAsRead = catchAsync(async (req, res) => {
  const updatedRecipients = await prisma.notificationUser.updateMany({
    where: {
      userId: req.user.id,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'All notifications marked as read successfully',
    data: updatedRecipients,
  });
});

export const NotificationServices = {
  createNotification,
  getAllNotifications,
  getUsersByNotification,
  markNotificationAsRead,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
};