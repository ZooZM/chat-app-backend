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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const users_service_1 = require("../users/users.service");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let AuthService = class AuthService {
    usersService;
    jwtService;
    configService;
    redisClient;
    constructor(usersService, jwtService, configService, redisClient) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.redisClient = redisClient;
    }
    async sendOtp(sendOtpDto) {
        const { phoneNumber } = sendOtpDto;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redisClient.set(phoneNumber, otp, 'EX', 180);
        console.log(`[OTP GENERATED] target: ${phoneNumber}, code: ${otp}`);
        return { message: 'OTP sent successfully' };
    }
    async verifyOtp(verifyOtpDto) {
        const { phoneNumber, code } = verifyOtpDto;
        const storedOtp = await this.redisClient.get(phoneNumber);
        if (!storedOtp || storedOtp !== code) {
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        let user = await this.usersService.findByPhoneNumber(phoneNumber);
        if (!user) {
            user = await this.usersService.create({
                phoneNumber,
                name: 'New User',
                isPhoneVerified: true
            });
        }
        else if (!user.isPhoneVerified) {
            user.isPhoneVerified = true;
            await user.save();
        }
        await this.redisClient.del(phoneNumber);
        return this.generateAuthResponse(user);
    }
    async generateAuthResponse(user) {
        const payload = { sub: user._id.toString(), phoneNumber: user.phoneNumber };
        const accessTokenExpiresIn = this.configService.get('JWT_ACCESS_EXPIRES_IN') || '15m';
        const refreshTokenExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d';
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, { expiresIn: accessTokenExpiresIn }),
            this.jwtService.signAsync(payload, { expiresIn: refreshTokenExpiresIn }),
        ]);
        await this.usersService.updateRefreshToken(user._id.toString(), refreshToken);
        const userObj = user.toObject();
        delete userObj.password;
        delete userObj.refreshToken;
        return {
            accessToken,
            refreshToken,
            user: userObj,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService,
        ioredis_1.default])
], AuthService);
//# sourceMappingURL=auth.service.js.map