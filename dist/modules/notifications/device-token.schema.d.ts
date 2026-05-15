import { Document, Types } from 'mongoose';
export type DeviceTokenDocument = DeviceToken & Document;
export declare class DeviceToken {
    userId: Types.ObjectId;
    token: string;
    platform: 'fcm' | 'apns';
}
export declare const DeviceTokenSchema: import("mongoose").Schema<DeviceToken, import("mongoose").Model<DeviceToken, any, any, any, any, any, DeviceToken>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, DeviceToken, Document<unknown, {}, DeviceToken, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, DeviceToken, Document<unknown, {}, DeviceToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    token?: import("mongoose").SchemaDefinitionProperty<string, DeviceToken, Document<unknown, {}, DeviceToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    platform?: import("mongoose").SchemaDefinitionProperty<"fcm" | "apns", DeviceToken, Document<unknown, {}, DeviceToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, DeviceToken>;
