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
exports.MapController = void 0;
const common_1 = require("@nestjs/common");
const map_service_1 = require("./map.service");
const update_location_dto_1 = require("./dto/update-location.dto");
const nearby_users_dto_1 = require("./dto/nearby-users.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
let MapController = class MapController {
    mapService;
    constructor(mapService) {
        this.mapService = mapService;
    }
    async updateLocation(req, updateLocationDto) {
        const { userId } = req.user;
        const { longitude, latitude } = updateLocationDto;
        await this.mapService.updateLocation(userId, longitude, latitude);
        return { message: 'Location updated successfully' };
    }
    async getNearbyUsers(req, query) {
        const { userId } = req.user;
        const { longitude, latitude, radius } = query;
        const users = await this.mapService.getNearbyUsers(userId, longitude, latitude, radius || 10);
        return { users };
    }
};
exports.MapController = MapController;
__decorate([
    (0, common_1.Patch)('location'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_location_dto_1.UpdateLocationDto]),
    __metadata("design:returntype", Promise)
], MapController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Get)('nearby'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, nearby_users_dto_1.NearbyUsersDto]),
    __metadata("design:returntype", Promise)
], MapController.prototype, "getNearbyUsers", null);
exports.MapController = MapController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('map'),
    __metadata("design:paramtypes", [map_service_1.MapService])
], MapController);
//# sourceMappingURL=map.controller.js.map