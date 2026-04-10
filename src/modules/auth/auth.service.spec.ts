import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: any;
  let jwtService: any;
  let configService: any;
  let redisClientMock: any;

  const mockUser = {
    _id: 'user123',
    name: 'John Doe',
    phoneNumber: '+1234567890',
    email: 'john@example.com',
    password: 'hashedPassword',
    isPhoneVerified: true,
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnValue({
      _id: 'user123',
      name: 'John Doe',
      phoneNumber: '+1234567890',
      email: 'john@example.com',
    }),
  };

  const mockTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };

  beforeEach(async () => {
    usersService = {
      findByPhoneNumber: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('test-token'),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return null;
      }),
    };

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      name: 'John Doe',
      phoneNumber: '+1234567890',
      email: 'john@example.com',
      password: 'password123',
    };

    it('should successfully register a new user and return tokens', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);

      const result = await authService.register(registerDto);

      expect(usersService.findByPhoneNumber).toHaveBeenCalledWith(registerDto.phoneNumber);
      expect(usersService.create).toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toEqual({
        _id: 'user123',
        name: 'John Doe',
        phoneNumber: '+1234567890',
        email: 'john@example.com',
      });
    });

    it('should throw ConflictException if the phone number already exists', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(mockUser as any);

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if the email already exists', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      phoneNumber: '+1234567890',
      password: 'password123',
    };

    it('should successfully log in and return tokens with valid credentials', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(loginDto);

      expect(usersService.findByPhoneNumber).toHaveBeenCalledWith(loginDto.phoneNumber);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
      expect(result).toHaveProperty('accessToken');
      expect(result.user.name).toBe(mockUser.name);
    });

    it('should throw UnauthorizedException if the user is not found', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if the password does not match', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user has no password', async () => {
      const userNoPass = { ...mockUser, password: null };
      usersService.findByPhoneNumber.mockResolvedValue(userNoPass as any);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sendOtp', () => {
    it('should successfully send an OTP', async () => {
      redisClientMock.set.mockResolvedValue('OK');

      const result = await authService.sendOtp({ phoneNumber: '+1234567890' });

      expect(redisClientMock.set).toHaveBeenCalled();
      expect(result).toEqual({ message: 'OTP sent successfully' });
    });
  });

  describe('verifyOtp', () => {
    it('should throw UnauthorizedException for invalid OTP', async () => {
      redisClientMock.get.mockResolvedValue('654321');

      await expect(
        authService.verifyOtp({ phoneNumber: '+1234567890', code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully verify OTP and return tokens', async () => {
      redisClientMock.get.mockResolvedValue('123456');
      usersService.findByPhoneNumber.mockResolvedValue(mockUser as any);

      const result = await authService.verifyOtp({ phoneNumber: '+1234567890', code: '123456' });

      expect(redisClientMock.del).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
    });
  });
});
