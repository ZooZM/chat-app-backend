"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
class BaseRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    async create(createEntityData) {
        const entity = new this.model(createEntityData);
        return await entity.save();
    }
    async findOne(filterQuery, projection) {
        return this.model.findOne(filterQuery, projection).exec();
    }
    async findOneAndUpdate(filterQuery, updateQuery, options) {
        return this.model.findOneAndUpdate(filterQuery, updateQuery, {
            new: true,
            ...options,
        }).exec();
    }
    async find(filterQuery, projection, options) {
        return this.model.find(filterQuery, projection, options).exec();
    }
    async updateOne(filterQuery, updateQuery, options) {
        return this.model.updateOne(filterQuery, updateQuery, options).exec();
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=base.repository.js.map