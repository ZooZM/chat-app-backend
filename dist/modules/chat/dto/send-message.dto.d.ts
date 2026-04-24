import { MessageType } from '../schemas/message.schema';
export declare class SendMessageDto {
    chatRoomId: string;
    content?: string;
    clientMessageId: string;
    type?: MessageType;
    fileUrl?: string;
    metadata?: Record<string, unknown>;
}
