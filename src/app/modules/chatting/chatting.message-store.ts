import { Message } from './type';

class MessageStore {
  private store: Map<string, Message[]> = new Map();

  private getRoom(roomId: string): Message[] {
    if (!this.store.has(roomId)) {
      this.store.set(roomId, []);
    }
    return this.store.get(roomId)!;
  }

  getMessages(roomId: string): Message[] {
    return this.getRoom(roomId);
  }

  addMessage(message: Message): Message {
    this.getRoom(message.roomId).push(message);
    return message;
  }

  editMessage(
    roomId: string,
    messageId: string,
    senderIp: string,
    content: string,
  ): Message | null {
    const messages = this.getRoom(roomId);
    const index = messages.findIndex(m => m.id === messageId);

    if (index === -1) return null;
    if (messages[index].senderIp !== senderIp) return null;

    messages[index] = {
      ...messages[index],
      content,
      updatedAt: new Date(),
      isEdited: true,
    };
    return messages[index];
  }

  deleteMessage(roomId: string, messageId: string, senderIp: string): boolean {
    const messages = this.getRoom(roomId);
    const index = messages.findIndex(m => m.id === messageId);

    if (index === -1) return false;
    if (messages[index].senderIp !== senderIp) return false;

    messages.splice(index, 1);
    return true;
  }

  deleteRoomMessages(roomId: string): void {
    this.store.delete(roomId);
  }
}

export const messageStore = new MessageStore();
