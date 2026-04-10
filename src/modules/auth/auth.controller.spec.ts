import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      _id: 'user123',
      name: 'John Doe',
      phoneNumber: '+1234567890',
    },
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn().mockResolvedValue(mockAuthResponse),
      login: jest.fn().mockResolvedValue(mockAuthResponse),
      sendOtp: jest.fn().mockResolvedValue({ message: 'OTP sent successfully' }),
      verifyOtp: jest.fn().mockResolvedValue(mockAuthResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register with correct DTO and return the result', async () => {
      const dto: RegisterDto = {
        name: 'John Doe',
        phoneNumber: '+1234567890',
        email: 'john@example.com',
        password: 'password123',
      };

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('login', () => {
    it('should call authService.login with correct DTO and return the result', async () => {
      const dto: LoginDto = {
        phoneNumber: '+1234567890',
        password: 'password123',
      };

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('sendOtp', () => {
    it('should call authService.sendOtp with correct DTO', async () => {
      const dto: SendOtpDto = { phoneNumber: '+1234567890' };
      
      const result = await controller.sendOtp(dto);

      expect(authService.sendOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'OTP sent successfully' });
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp with correct DTO', async () => {
      const dto: VerifyOtpDto = { phoneNumber: '+1234567890', code: '123456' };

      const result = await controller.verifyOtp(dto);

      expect(authService.verifyOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });
});
