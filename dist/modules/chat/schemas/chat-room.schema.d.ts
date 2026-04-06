import { Document, Types } from 'mongoose';
export declare enum ChatRoomType {
    PRIVATE = "PRIVATE",
    GROUP = "GROUP"
}
export type ChatRoomDocument = ChatRoom & Document;
export declare class ChatRoom {
    participants: Types.ObjectId[];
    type: string;
    lastMessage?: Types.ObjectId;
}
export declare const ChatRoomSchema: import("mongoose").Schema<ChatRoom, import("mongoose").Model<ChatRoom, any, any, any, any, any, ChatRoom>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatRoom, Document<unknown, {}, ChatRoom, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<ChatRoom & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    participants?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId[], ChatRoom, Document<unknown, {}, ChatRoom, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ChatRoom & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<string, ChatRoom, Document<unknown, {}, ChatRoom, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ChatRoom & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    lastMessage?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, ChatRoom, Document<unknown, {}, ChatRoom, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ChatRoom & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, ChatRoom>;
