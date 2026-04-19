import { Model } from 'mongoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { MessageDocument } from './schemas/message.schema';
export declare class MessagesRepository extends BaseRepository<MessageDocument> {
    private readonly messageModel;
    constructor(messageModel: Model<MessageDocument>);
    getRoomMessages(roomId: string, limit: number, cursor?: string): Promise<MessageDocument[]>;
    markRead(messageIds: string[], phoneNumber: string): Promise<void>;
}
