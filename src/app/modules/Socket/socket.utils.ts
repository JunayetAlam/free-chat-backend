import { Room } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { WebSocket } from "ws";
import { Conversation } from "./socket.validation";




interface CustomWebSocket extends WebSocket {
    userId?: string;
}

export async function getRoomImage(room: Room, currentUserId: string) {


    if (room.roomType === 'SINGLE') {
        const otherUserId = room.participants.find(id => id !== currentUserId);
        const otherUser = await prisma.user.findUnique({
            where: { id: otherUserId }, select: {
                profilePhoto: true,
                firstName: true,
                lastName: true
            }
        });
        return { photo: otherUser?.profilePhoto || null, name: otherUser?.firstName + ' ' + otherUser?.lastName };
    } else {
        return { photo: room.groupPhoto, name: room.name };
    }
}


export async function readAll({ roomId, userId }: { roomId: string, userId: string }) {
    await prisma.message.updateMany({
        where: {
            roomId,
            isRead: false,
            NOT: {
                senderId: userId
            }
        },
        data: {
            isRead: true
        }
    });
}


export const getConversationsForUser = async (targetUserId: string, connectedUsers: Set<CustomWebSocket>) => {
    const conversations = await prisma.room.findMany({
        where: {
            participants: {
                has: targetUserId
            }
        },
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                    content: true,
                    fileUrl: true,
                    createdAt: true,
                    sender: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    },
                },

            },
            _count: {
                select: {
                    messages: {
                        where: {
                            isRead: false,
                            NOT: {
                                senderId: targetUserId
                            },
                        }
                    }
                }
            }
        },
    });

    const connectedUserIds = Array.from(connectedUsers).map(item => item.userId).filter(id => id !== undefined);

    const formattedConversations: Conversation[] = await Promise.all(
        conversations.map(async room => {
            const allUsers = room.participants;
            const connectedUserIdsWithoutMe = connectedUserIds.filter(item => item !== targetUserId);
            const isActive = !!allUsers.find(item => connectedUserIdsWithoutMe.includes(item));

            return {
                id: room.id,
                createdAt: room.createdAt,
                lastMessage: {
                    content: room.messages[0]?.content
                        ? room.messages[0]?.content
                        : "sent file",
                    createdAt: room.messages[0]?.createdAt || null,
                },
                isActive,
                unreadCount: room._count.messages || 0,
                ...await getRoomImage(room, targetUserId)
            }
        })
    );
    return formattedConversations
};