import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { Server, Socket } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let chatService: jest.Mocked<Partial<ChatService>>;

  const mockSocket = {
    id: 'test-socket-id',
    handshake: {
      headers: { authorization: 'Bearer test-token' },
      auth: { token: 'test-token' },
      query: {},
    },
    user: { userId: 'user-123', phoneNumber: '+123' },
    disconnect: jest.fn(),
    join: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  } as any;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as any;

  beforeEach(async () => {
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-123', phoneNumber: '+123' }),
    };
    chatService = {
      saveMessage: jest.fn().mockResolvedValue({ _id: 'msg-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: ChatService, useValue: chatService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should verify token and set user on socket', async () => {
      await gateway.handleConnection(mockSocket);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('test-token');
      expect(mockSocket.user).toEqual({ userId: 'user-123', phoneNumber: '+123' });
    });

    it('should disconnect if token verification fails', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('Invalid token'));
      await gateway.handleConnection(mockSocket);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleJoinRoom', () => {
    it('should join the room', async () => {
      const result = await gateway.handleJoinRoom(mockSocket, 'room-456');
      expect(mockSocket.join).toHaveBeenCalledWith('room-456');
      expect(result).toEqual({ event: 'joinedRoom', data: 'room-456' });
    });
  });

  describe('handleSendMessage', () => {
    it('should save message and emit to room', async () => {
      const payload = { chatRoomId: 'room-456', content: 'Hello' };
      const result = await gateway.handleSendMessage(mockSocket, payload);
      
      expect(chatService.saveMessage).toHaveBeenCalledWith('user-123', payload);
      expect(mockServer.to).toHaveBeenCalledWith('room-456');
      expect(mockServer.emit).toHaveBeenCalledWith('newMessage', expect.any(Object));
      expect(result).toEqual({ event: 'messageSent', data: 'msg-123' });
    });
  });
});
