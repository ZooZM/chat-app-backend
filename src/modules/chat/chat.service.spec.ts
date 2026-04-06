import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatRoom } from './schemas/chat-room.schema';
import { Message } from './schemas/message.schema';
import { Types, Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let chatRoomModel: any;
  let messageModel: any;

  const mockRoom = {
    _id: new Types.ObjectId(),
    type: 'PRIVATE',
    participants: [new Types.ObjectId(), new Types.ObjectId()],
    save: jest.fn().mockResolvedValue({}),
  };

  const mockMessage = {
    _id: new Types.ObjectId(),
    chatRoomId: mockRoom._id,
    senderId: mockRoom.participants[0],
    content: 'Hello',
    save: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    chatRoomModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      constructor: jest.fn().mockImplementation(() => mockRoom),
    };
    // To handle 'new this.chatRoomModel'
    const chatRoomConstructor = jest.fn().mockReturnValue(mockRoom);
    Object.assign(chatRoomConstructor, chatRoomModel);

    messageModel = {
      find: jest.fn(),
      save: jest.fn(),
      constructor: jest.fn().mockImplementation(() => mockMessage),
    };
    const messageConstructor = jest.fn().mockReturnValue(mockMessage);
    Object.assign(messageConstructor, messageModel);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getModelToken(ChatRoom.name), useValue: chatRoomConstructor },
        { provide: getModelToken(Message.name), useValue: messageConstructor },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPrivateRoom', () => {
    it('should return an existing room if it exists', async () => {
      chatRoomModel.findOne.mockResolvedValue(mockRoom);
      const result = await service.createPrivateRoom(
        mockRoom.participants[0].toHexString(),
        mockRoom.participants[1].toHexString(),
      );
      expect(result).toEqual(mockRoom);
      expect(chatRoomModel.findOne).toHaveBeenCalled();
    });

    it('should create a new room if it does not exist', async () => {
      chatRoomModel.findOne.mockResolvedValue(null);
      const result = await service.createPrivateRoom(
        mockRoom.participants[0].toHexString(),
        mockRoom.participants[1].toHexString(),
      );
      expect(result).toBeDefined();
    });
  });

  describe('saveMessage', () => {
    it('should throw NotFoundException if room does not exist', async () => {
      chatRoomModel.findById.mockResolvedValue(null);
      await expect(
        service.saveMessage(mockRoom.participants[0].toHexString(), {
          chatRoomId: mockRoom._id.toHexString(),
          content: 'Hi',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should save a message and update room lastMessage', async () => {
      chatRoomModel.findById.mockResolvedValue(mockRoom);
      const result = await service.saveMessage(mockRoom.participants[0].toHexString(), {
        chatRoomId: mockRoom._id.toHexString(),
        content: 'Hi',
      });
      expect(result).toBeDefined();
      expect(mockRoom.save).toHaveBeenCalled();
    });
  });

  describe('getUserRooms', () => {
    it('should query rooms for the given user', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockRoom]),
      };
      chatRoomModel.find.mockReturnValue(mockQuery);

      const result = await service.getUserRooms(mockRoom.participants[0].toHexString());
      expect(result).toEqual([mockRoom]);
      expect(chatRoomModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ participants: expect.anything() }),
      );
    });
  });
});
