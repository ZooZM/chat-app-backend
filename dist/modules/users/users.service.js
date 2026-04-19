"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const users_repository_1 = require("./users.repository");
let UsersService = class UsersService {
    usersRepository;
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async create(createData) {
        try {
            const existingUser = await this.usersRepository.findByPhoneNumber(createData.phoneNumber);
            if (existingUser) {
                throw new common_1.ConflictException('User with this phone number already exists');
            }
            let hashedPassword;
            if (createData.password) {
                hashedPassword = await bcrypt.hash(createData.password, 10);
            }
            const newUser = await this.usersRepository.create({
                ...createData,
                ...(hashedPassword && { password: hashedPassword }),
            });
            return newUser;
        }
        catch (error) {
            if (error instanceof common_1.ConflictException)
                throw error;
            throw new common_1.InternalServerErrorException('Error creating user');
        }
    }
    async findByPhoneNumber(phoneNumber) {
        return this.usersRepository.findByPhoneNumber(phoneNumber);
    }
    async findByEmail(email) {
        return this.usersRepository.findOne({ email });
    }
    async findById(id) {
        return this.usersRepository.findById(id);
    }
    async updateRefreshToken(id, refreshToken) {
        await this.usersRepository.updateOne({ _id: id }, { refreshToken });
    }
    async updateLocation(userId, lng, lat) {
        await this.usersRepository.updateOne({ _id: userId }, {
            $set: {
                location: {
                    type: 'Point',
                    coordinates: [lng, lat],
                },
            },
        });
    }
    async getNearbyUsers(userId, lng, lat, maxDistanceKm) {
        return this.usersRepository.getNearbyUsers(userId, lng, lat, maxDistanceKm);
    }
    async syncContacts(phoneNumbers) {
        return this.usersRepository.findByPhoneNumbers(phoneNumbers);
    }
    async updateOnlineStatus(userId, isOnline) {
        await this.usersRepository.updateOne({ _id: userId }, { isOnline });
        const user = await this.usersRepository.findById(userId);
        console.log(`User ${userId} is ${user?.isOnline}`);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_repository_1.UsersRepository])
], UsersService);
//# sourceMappingURL=users.service.js.map