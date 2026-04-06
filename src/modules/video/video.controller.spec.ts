import { Test, TestingModule } from '@nestjs/testing';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

describe('VideoController', () => {
  let controller: VideoController;
  let videoService: jest.Mocked<Partial<VideoService>>;

  beforeEach(async () => {
    videoService = {
      generateRoomToken: jest.fn().mockResolvedValue('test-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoController],
      providers: [
        { provide: VideoService, useValue: videoService },
      ],
    }).compile();

    controller = module.get<VideoController>(VideoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('joinRoom', () => {
    it('should return a token', async () => {
      const mockRequest = {
        user: { userId: 'user-123', name: 'John' },
      };
      const result = await controller.joinRoom('room-456', mockRequest);
      
      expect(videoService.generateRoomToken).toHaveBeenCalledWith('user-123', 'John', 'room-456');
      expect(result).toEqual({ token: 'test-token' });
    });
  });
});
