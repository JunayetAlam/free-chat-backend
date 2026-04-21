import { Request } from 'express';
import httpStatus from 'http-status';
import { WebSocket, WebSocketServer } from "ws";
import { prisma } from '../../utils/prisma';
import { getConversationsForUser, getRoomImage, readAll } from './socket.utils';
import { Message } from '@prisma/client';
import { Conversation } from './socket.validation';
import { checkRoles, socketAuth } from '../../middlewares/socketAuth';

interface CustomWebSocket extends WebSocket {
    userId?: string;
}




const roomUsers = new Map<string, Set<WebSocket>>();
const connectedUsers = new Set<CustomWebSocket>();

let wss;


export function setupWebSocketServer(server: any) {
    wss = new WebSocketServer({ server });
    wss.on('connection', async (ws: CustomWebSocket, req: Request) => {
        console.log({ connectedUser: Array.from(connectedUsers).map(item => item.userId) })
        const token = req.headers.authorization;
        const user = await socketAuth(ws, token);
        if (!user) return;

        // if (!checkSubscription(ws, user)) return;
        if (!checkRoles(ws, user, ['ANY'])) return;
        const userId = user.id;
        ws.userId = userId;
        connectedUsers.add(ws);
        if (!roomUsers.has(userId)) roomUsers.set(userId, new Set());
        roomUsers.get(userId)?.add(ws)
        let exactRoomId: string | null = null;
        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, 30000);



        const formattedConversations = await getConversationsForUser(userId, connectedUsers)
        const connectedUserIds = Array.from(connectedUsers).map(item => item.userId).filter(id => id !== undefined);
        ws.send(JSON.stringify({
            type: 'conversation-list',
            conversations: formattedConversations
        }));
        ws.on("message", async (message: any) => {
            try {
                const { type, roomId, content, fileUrl, receiverId } = JSON.parse(
                    message.toString()
                );

                exactRoomId = roomId
                switch (type) {
                    case 'subscribe': {
                        let pastMessages: Message[] = [];
                        if (!receiverId && !roomId) {
                            return ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "receiverId or roomId is required",
                                })
                            );
                        }

                        if (roomId) {
                            await readAll({ roomId, userId })

                        }

                        if (!roomId) {
                            await prisma.user.findFirstOrThrow({
                                where: {
                                    id: receiverId
                                }
                            });
                            const createRoom = await prisma.room.create({
                                data: {
                                    participants: [userId, receiverId]
                                }
                            })
                            exactRoomId = createRoom.id;


                        }


                        roomUsers.forEach((clients, key) => {
                            if (clients.has(ws)) {
                                clients.delete(ws)
                            };
                        });
                        if (exactRoomId) {
                            if (!roomUsers.has(exactRoomId)) roomUsers.set(exactRoomId, new Set());
                            roomUsers.get(exactRoomId)?.add(ws);
                            if (exactRoomId) {
                                pastMessages = await prisma.message.findMany({
                                    where: { roomId: exactRoomId },
                                    orderBy: { createdAt: "desc" },
                                });
                            }
                        }
                        ws.send(
                            JSON.stringify({
                                type: "past-messages",
                                roomId: exactRoomId,
                                messages: pastMessages,
                            })
                        );
                        break;
                    }
                    case "send-message": {
                        const createdAt = new Date()
                        if (!exactRoomId) {
                            return ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "You are not subscribed to any room",
                                })
                            );
                        };
                        try {
                            await readAll({ roomId: exactRoomId, userId });

                            const room = await prisma.room.update({
                                where: {
                                    id: exactRoomId,
                                },
                                data: {
                                    updatedAt: createdAt,
                                    messages: {
                                        create: {
                                            content,
                                            fileUrl,
                                            senderId: userId,
                                            createdAt: createdAt
                                        }
                                    }
                                },
                                include: {
                                    messages: {
                                        where: {
                                            senderId: userId,
                                            createdAt: createdAt,
                                        },
                                        orderBy: {
                                            createdAt: 'desc'
                                        },
                                        take: 1
                                    }
                                }
                            });
                            const allUsers = room.participants;
                            const connectedUserIdsWithoutMe = connectedUserIds.filter(item => item !== userId);
                            const existingData = formattedConversations.find(item => item.id === exactRoomId)
                            const { photo, name } = existingData ? existingData : await getRoomImage(room, userId)
                            const newConversation: Conversation = {
                                unreadCount: 0,
                                photo,
                                name,
                                createdAt: createdAt,
                                id: exactRoomId,
                                isActive: !!allUsers.find(item => connectedUserIdsWithoutMe.includes(item)),
                                lastMessage: {
                                    content: content
                                        ? content
                                        : "sent file",
                                    createdAt: createdAt,
                                },
                            };

                            roomUsers.get(exactRoomId)?.forEach((client) => {
                                if (client.readyState === WebSocket.OPEN) {
                                    client.send(
                                        JSON.stringify({
                                            type: "new-message",
                                            message: room.messages[0] || {},
                                            roomId: roomId,
                                        })
                                    );
                                }
                            });
                            const conversationLists = room.participants
                            const target = Array.from(connectedUsers).filter(item => item.userId !== userId).filter(
                                (client) => conversationLists.includes(client.userId as string)
                            );
                            if (target) {

                                const receiverConversationItem: Conversation = {
                                    id: exactRoomId,
                                    createdAt,
                                    lastMessage: {
                                        createdAt,
                                        content: content
                                            ? content
                                            : "sent file",
                                    },
                                    isActive: true,
                                    photo: room.roomType === 'SINGLE' ? user.profilePhoto : room.groupPhoto,
                                    name: room.roomType === 'SINGLE' ? (user.firstName + ' ' + user.lastName) : room.name,
                                    countIncreaseBy: 1
                                }

                                target.map(item => {
                                    item.send(
                                        JSON.stringify({
                                            type: "new-conversation",
                                            conversations: receiverConversationItem,
                                        })
                                    );
                                })
                                ws.send(
                                    JSON.stringify({
                                        type: "new-conversation",
                                        conversations: newConversation,
                                    })
                                );
                            }

                        } catch (error) {
                            console.log({ error })
                            return ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "Something went wrong",
                                    error
                                })
                            );
                        }

                        break;
                    }
                    case "conversation-list": {
                        const formattedConversations = await getConversationsForUser(userId, connectedUsers)
                        ws.send(
                            JSON.stringify({
                                type: "conversation-list",
                                conversations: formattedConversations,
                            })
                        );
                        break;
                    }

                    case "read-message": {
                        if (!exactRoomId) {
                            return ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "You must join a room first!",
                                })
                            );
                        }
                        if (exactRoomId) {
                            const result = await prisma.message.updateMany({
                                where: {
                                    roomId: exactRoomId as string,
                                    isRead: false
                                },
                                data: {
                                    isRead: true
                                }
                            });
                            return ws.send(
                                JSON.stringify({
                                    type: "success",
                                    message: "Message Read Successfully!",
                                    result
                                })
                            )
                        } else {
                            return ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "You must join a room first!",
                                })
                            )
                        }
                        break;
                    }
                    case "send-candidate": {
                        if (!exactRoomId) {
                            return ws.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "You must join a room first!",
                                })
                            );
                        }

                        const clients = roomUsers.get(exactRoomId);
                        if (!clients) break;
                        for (const client of clients) {
                            if (client !== ws && client.readyState === WebSocket.OPEN) {
                                client.send(
                                    JSON.stringify({
                                        type: "receive-candidate",
                                        candidate: content,
                                        userId,
                                    })
                                );
                            }
                        }
                        break;
                    }

                    default:
                        ws.send(
                            JSON.stringify({ type: "error", message: "Invalid message type" })
                        );

                }
            } catch (error) {
                console.log({ error })
                ws.send(
                    JSON.stringify({ type: "error", message: "Something Went Wrong", error: error })
                );
            }
        });

        ws.on("close", async () => {
            connectedUsers?.delete(ws);

            if (exactRoomId) {
                const clients = roomUsers.get(exactRoomId);
                clients?.delete(ws);
                if (clients?.size === 0) roomUsers.delete(exactRoomId);
            }

            console.log("WebSocket client disconnected!");
            clearInterval(interval);
        });


    })
}

export const socket = { wss, roomUsers }