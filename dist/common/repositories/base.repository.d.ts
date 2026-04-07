import { Model, Document } from 'mongoose';
export declare abstract class BaseRepository<T extends Document> {
    protected readonly model: Model<T>;
    constructor(model: Model<T>);
    create(createEntityData: unknown): Promise<T>;
    findOne(filterQuery: Record<string, any>, projection?: any): Promise<T | null>;
    findOneAndUpdate(filterQuery: Record<string, any>, updateQuery: Record<string, any>, options?: any): Promise<T | null>;
    find(filterQuery: Record<string, any>, projection?: any, options?: any): Promise<T[]>;
    updateOne(filterQuery: Record<string, any>, updateQuery: Record<string, any>, options?: any): Promise<import("mongoose").UpdateWriteOpResult>;
}
