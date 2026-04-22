import { Model } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { MessageDocument, MessageStatus } from './schemas/message.schema';
export declare class MessagesRepository extends BaseRepository<MessageDocument> {
    private readonly messageModel;
    constructor(messageModel: Model<MessageDocument>);
    getRoomMessages(roomId: string, limit: number, cursor?: string): Promise<MessageDocument[]>;
    markDelivered(messageIds: string[], phoneNumber: string): Promise<void>;
    markRead(messageIds: string[], phoneNumber: string): Promise<void>;
    findByClientMessageId(clientMessageId: string): Promise<MessageDocument | null>;
    fetchStatusesByClientIds(clientMessageIds: string[]): Promise<{
        clientMessageId: string;
        status: MessageStatus;
    }[]>;
}
