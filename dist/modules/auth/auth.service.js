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
const bcrypt = __importStar(require("bcrypt"));
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
    async register(registerDto) {
        const { name, phoneNumber, email, password } = registerDto;
        if (phoneNumber) {
            const existingPhone = await this.usersService.findByPhoneNumber(phoneNumber);
            if (existingPhone)
                throw new common_1.ConflictException('User with this phone number already exists');
        }
        if (email) {
            const existingEmail = await this.usersService.findByEmail(email);
            if (existingEmail)
                throw new common_1.ConflictException('User with this email already exists');
        }
        const user = await this.usersService.create({
            name,
            phoneNumber,
            email,
            password,
            isPhoneVerified: false,
        });
        return this.generateAuthResponse(user);
    }
    async login(loginDto) {
        const { phoneNumber, email, password } = loginDto;
        let user;
        if (phoneNumber) {
            user = await this.usersService.findByPhoneNumber(phoneNumber);
        }
        else if (email) {
            user = await this.usersService.findByEmail(email);
        }
        if (!user || !user.password) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return this.generateAuthResponse(user);
    }
    async generateAuthResponse(user) {
        const payload = { sub: user._id.toString(), phoneNumber: user.phoneNumber, name: user.name };
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