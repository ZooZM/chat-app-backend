import { Injectable, UnauthorizedException, Inject, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';

// Load-bearing per Flutter contract (specs/009-persistent-session): the Flutter
// client treats these two 401 message strings as the only terminal session signals.
// Any rename here MUST be coordinated with TokenRefreshService._isRevocationResponse().
export const AUTH_ERR_REVOKED = 'Refresh token revoked';
export const AUTH_ERR_INVALID_OR_EXPIRED = 'Invalid or expired refresh token';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
  ) { }

  async sendOtp(sendOtpDto: SendOtpDto): Promise<{ message: string }> {
    const { phoneNumber } = sendOtpDto;

    // TODO: TEMPORARY WORKAROUND - REMOVE BEFORE PRODUCTION
    // Hardcode OTP to 123456 and log to specific fixed email for testing
    const otp = '123456';
    const fixedEmail = 'zeyadmostafa201@gmail.com';

    // Save to Redis with 3-minute expiration (180 seconds)
    await this.redisClient.set(phoneNumber, otp, 'EX', 180);

    // In a real app, integrate SMS provider (Twilio/Firebase)
    console.log(`[OTP GENERATED] sending to fixed email: ${fixedEmail} (requested for: ${phoneNumber}), code: ${otp}`);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, code } = verifyOtpDto;

    const storedOtp = await this.redisClient.get(phoneNumber);
    if (!storedOtp || storedOtp !== code) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Check if user exists, if not create
    let user = await this.usersService.findByPhoneNumber(phoneNumber);
    if (!user) {
      user = await this.usersService.create({
        phoneNumber,
        name: 'New User', // Default name until they update their profile
        isPhoneVerified: true
      });
    } else if (!user.isPhoneVerified) {
      // If it exists but wasn't verified, verify it
      user.isPhoneVerified = true;
      await user.save();
    }

    // Clear the OTP
    await this.redisClient.del(phoneNumber);

    return this.generateAuthResponse(user);
  }

  async register(registerDto: RegisterDto) {
    const { name, phoneNumber, email, password } = registerDto;

    // Check if user already exists
    if (phoneNumber) {
      const existingPhone = await this.usersService.findByPhoneNumber(phoneNumber);
      if (existingPhone) throw new ConflictException('User with this phone number already exists');
    }
    if (email) {
      const existingEmail = await this.usersService.findByEmail(email);
      if (existingEmail) throw new ConflictException('User with this email already exists');
    }

    // usersService.create handles bcrypt hashing internally
    const user = await this.usersService.create({
      name,
      phoneNumber,
      email,
      password,
      isPhoneVerified: false,
    });

    return this.generateAuthResponse(user);
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    let payload: { sub: string; phoneNumber: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET') || 'default-secret',
      });
    } catch {
      throw new UnauthorizedException(AUTH_ERR_INVALID_OR_EXPIRED);
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException(AUTH_ERR_REVOKED);
    }

    return this.generateAuthResponse(user);
  }

  async login(loginDto: LoginDto) {
    const { phoneNumber, email, password } = loginDto;

    let user;
    if (phoneNumber) {
      user = await this.usersService.findByPhoneNumber(phoneNumber);
    } else if (email) {
      user = await this.usersService.findByEmail(email);
    }

    if (!user || !user.password) {
      // If user registered with OTP only, they might not have a password
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateAuthResponse(user);
  }

  private async generateAuthResponse(user: any) {
    const payload = { sub: user._id.toString(), phoneNumber: user.phoneNumber, name: user.name };

    const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshTokenExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '365d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: accessTokenExpiresIn as any }),
      this.jwtService.signAsync(payload, { expiresIn: refreshTokenExpiresIn as any }),
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
}
