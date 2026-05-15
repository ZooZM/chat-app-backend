"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceTokensRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const device_token_schema_1 = require("./device-token.schema");
let DeviceTokensRepository = class DeviceTokensRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    async upsertToken(userId, token, platform) {
        await this.model.findOneAndUpdate({ userId: new mongoose_2.Types.ObjectId(userId), token }, { $set: { platform, userId: new mongoose_2.Types.ObjectId(userId), token } }, { upsert: true }).exec();
    }
    async getTokens(userId) {
        return this.model.find({ userId: new mongoose_2.Types.ObjectId(userId) }).exec();
    }
    async deleteAllTokensForUser(userId) {
        await this.model.deleteMany({ userId: new mongoose_2.Types.ObjectId(userId) }).exec();
    }
};
exports.DeviceTokensRepository = DeviceTokensRepository;
exports.DeviceTokensRepository = DeviceTokensRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(device_token_schema_1.DeviceToken.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DeviceTokensRepository);
//# sourceMappingURL=device-tokens.repository.js.map