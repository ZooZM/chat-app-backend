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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapService = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("../users/users.service");
let MapService = class MapService {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async updateLocation(userId, lng, lat) {
        return this.usersService.updateLocation(userId, lng, lat);
    }
    async getNearbyUsers(userId, lng, lat, maxDistanceKm) {
        return this.usersService.getNearbyUsers(userId, lng, lat, maxDistanceKm);
    }
};
exports.MapService = MapService;
exports.MapService = MapService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], MapService);
//# sourceMappingURL=map.service.js.map