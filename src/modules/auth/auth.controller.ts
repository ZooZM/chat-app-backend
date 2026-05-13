import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DeviceTokensRepository } from '../notifications/device-tokens.repository';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly deviceTokensRepository: DeviceTokensRepository,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('send-otp')
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('device-token')
  async registerDeviceToken(
    @Request() req: any,
    @Body() dto: { token: string; platform: 'fcm' | 'apns' },
  ) {
    await this.deviceTokensRepository.upsertToken(req.user.userId, dto.token, dto.platform);
  }
}
