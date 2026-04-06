import { Test, TestingModule } from '@nestjs/testing';
import { VideoService } from './video.service';
import { ConfigService } from '@nestjs/config';

// Mock livekit-server-sdk
jest.mock('livekit-server-sdk', () => {
  return {
    AccessToken: jest.fn().mockImplementation(() => ({
      addGrant: jest.fn(),
      toJwt: jest.fn().mockResolvedValue('mock-livekit-token'),
    })),
  };
});

describe('VideoService', () => {
  let service: VideoService;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'LIVEKIT_API_KEY') return 'api-key';
        if (key === 'LIVEKIT_API_SECRET') return 'api-secret';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<VideoService>(VideoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRoomToken', () => {
    it('should generate a token for the user and room', async () => {
      const token = await service.generateRoomToken('user-123', 'John Doe', 'room-abc');
      expect(token).toBe('mock-livekit-token');
      expect(configService.get).toHaveBeenCalledWith('LIVEKIT_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('LIVEKIT_API_SECRET');
    });
  });
});
