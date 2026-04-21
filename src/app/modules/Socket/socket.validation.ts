export type Conversation = {
    photo: string | null;
    name: string;
    id: string;
    createdAt: Date;
    lastMessage: {
        content: string;
        createdAt: Date;
    };
    isActive: boolean;
    unreadCount?: number;
    countIncreaseBy?: number;
}
