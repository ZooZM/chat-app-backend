import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { DeviceTokensRepository } from '../notifications/device-tokens.repository';
export declare class AuthController {
    private readonly authService;
    private readonly deviceTokensRepository;
    constructor(authService: AuthService, deviceTokensRepository: DeviceTokensRepository);
    register(registerDto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
    }>;
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
    }>;
    sendOtp(sendOtpDto: SendOtpDto): Promise<{
        message: string;
    }>;
    verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
    }>;
    refresh(refreshTokenDto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: any;
    }>;
    registerDeviceToken(req: any, dto: {
        token: string;
        platform: 'fcm' | 'apns';
    }): Promise<void>;
    unregisterDeviceTokens(req: any): Promise<void>;
}
