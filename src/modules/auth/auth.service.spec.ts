import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;
  let redisClientMock: any;

  beforeEach(async () => {
    // Mock UsersService
    usersService = {
      findByPhoneNumber: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    // Mock JwtService
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('test-token'),
    };

    // Mock ConfigService
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return null;
      }),
    };

    // Mock Redis Client
    redisClientMock = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: 'REDIS_CLIENT', useValue: redisClientMock },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('sendOtp', () => {
    it('should generate an OTP, save it to Redis, and yield success message', async () => {
      const result = await authService.sendOtp({ phoneNumber: '+1234567890' });

      // Verify the response
      expect(result).toEqual({ message: 'OTP sent successfully' });

      // We ensure the redis set command was called with standard TTL config
      expect(redisClientMock.set).toHaveBeenCalledTimes(1);
      expect(redisClientMock.set).toHaveBeenCalledWith(
        '+1234567890',
        expect.any(String),
        'EX',
        180,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should throw UnauthorizedException if OTP does not match', async () => {
      // Redis returns incorrect OTP
      redisClientMock.get.mockResolvedValue('000000');

      await expect(
        authService.verifyOtp({ phoneNumber: '+1234567890', code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should create a new user, issue tokens, and clear OTP upon valid OTP for new phone number', async () => {
      // Redis returns correct OTP
      redisClientMock.get.mockResolvedValue('123456');

      // UsersService returns null (doesn't exist)
      usersService.findByPhoneNumber = jest.fn().mockResolvedValue(null);

      // Create returns a mock user document instance
      const mockUserDoc = {
        _id: 'user-123',
        phoneNumber: '+1234567890',
        isPhoneVerified: true,
        toObject: jest.fn().mockReturnValue({ _id: 'user-123', phoneNumber: '+1234567890' }),
      };
      usersService.create = jest.fn().mockResolvedValue(mockUserDoc);

      const result = await authService.verifyOtp({ phoneNumber: '+1234567890', code: '123456' });

      // Assertions
      expect(usersService.create).toHaveBeenCalledWith({
        phoneNumber: '+1234567890',
        name: 'New User',
        isPhoneVerified: true,
      });

      expect(redisClientMock.del).toHaveBeenCalledWith('+1234567890');
      
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2); // accessToken + refreshToken
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith('user-123', 'test-token');

      expect(result).toEqual({
        accessToken: 'test-token',
        refreshToken: 'test-token',
        user: { _id: 'user-123', phoneNumber: '+1234567890' },
      });
    });

    it('should issue tokens for an existing user and clear OTP', async () => {
      redisClientMock.get.mockResolvedValue('123456');

      const mockExistingUser = {
        _id: 'user-456',
        phoneNumber: '+0987654321',
        isPhoneVerified: true,
        save: jest.fn(),
        toObject: jest.fn().mockReturnValue({ _id: 'user-456', phoneNumber: '+0987654321' }),
      };
      
      usersService.findByPhoneNumber = jest.fn().mockResolvedValue(mockExistingUser);

      const result = await authService.verifyOtp({ phoneNumber: '+0987654321', code: '123456' });

      // Assuming they are already verified, we skip checking the `.save()` mock entirely unless requested
      expect(usersService.create).not.toHaveBeenCalled();
      expect(redisClientMock.del).toHaveBeenCalledWith('+0987654321');
      expect(result.accessToken).toBeDefined();
    });
  });
});
