import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class AuthService {
    private usersService;
    private jwtService;
    private configService;
    private redisClient;
    constructor(usersService: UsersService, jwtService: JwtService, configService: ConfigService, redisClient: Redis);
    sendOtp(sendOtpDto: SendOtpDto): Promise<{
        message: string;
    }>;
    verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
    }>;
    private generateAuthResponse;
}
