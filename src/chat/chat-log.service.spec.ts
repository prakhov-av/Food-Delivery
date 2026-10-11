import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatLogEntry, ChatLogService } from './chat-log.service';
import { ChatLog } from './chat-log.entity';
import { ChatLogKind } from './enums/chat-log-kind.enum';

describe('ChatLogService', (): void => {
  let service: ChatLogService;
  let repository: jest.Mocked<Repository<ChatLog>>;

  const ENTRY: ChatLogEntry = {
    userId: 10,
    userRole: 'CUSTOMER',
    question: 'q',
    answer: 'a',
    kind: ChatLogKind.KNOWLEDGE,
    documentType: 'ORDER',
    chunksFound: 2,
  };

  const ROW: ChatLog = { id: 1, ...ENTRY } as ChatLog;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatLogService,
        {
          provide: getRepositoryToken(ChatLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatLogService>(ChatLogService);
    repository = module.get(getRepositoryToken(ChatLog));

    (repository.create as jest.Mock).mockReturnValue(ROW);
    (repository.save as jest.Mock).mockResolvedValue(ROW);
    repository.delete.mockResolvedValue({ affected: 0, raw: [] });
  });

  describe('record', (): void => {
    it('should save the entry and delete expired rows of the same user', async (): Promise<void> => {
      await service.record(ENTRY);

      expect(repository.create).toHaveBeenCalledWith(ENTRY);
      expect(repository.save).toHaveBeenCalledWith(ROW);
      expect(repository.delete).toHaveBeenCalledWith({
        userId: 10,
        createdAt: expect.anything(),
      });
    });

    it('should not throw when saving fails', async (): Promise<void> => {
      (repository.save as jest.Mock).mockRejectedValue(new Error('DB down'));

      await expect(service.record(ENTRY)).resolves.toBeUndefined();

      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('findRecent', (): void => {
    it('should return the latest rows of the user from oldest to newest', async (): Promise<void> => {
      repository.find.mockResolvedValue([
        { id: 3 } as ChatLog,
        { id: 2 } as ChatLog,
        { id: 1 } as ChatLog,
      ]);

      const result: ChatLog[] = await service.findRecent(10, 50);

      expect(result.map((log: ChatLog): number => log.id)).toEqual([1, 2, 3]);
      expect(repository.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: 10 }),
        order: { id: 'DESC' },
        take: 50,
      });
    });
  });

  describe('getWindow', (): void => {
    it('should map rows with an answer to chat messages in chronological order', async (): Promise<void> => {
      repository.find.mockResolvedValue([
        { id: 2, question: 'q2', answer: 'a2' } as ChatLog,
        { id: 1, question: 'q1', answer: 'a1' } as ChatLog,
      ]);

      const result = await service.getWindow(10, 10);

      expect(result).toEqual([
        { userRequest: 'q1', aiAnswer: 'a1' },
        { userRequest: 'q2', aiAnswer: 'a2' },
      ]);
      expect(repository.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 10,
          answer: expect.anything(),
        }),
        order: { id: 'DESC' },
        take: 10,
      });
    });

    it('should return an empty window when loading fails', async (): Promise<void> => {
      repository.find.mockRejectedValue(new Error('DB down'));

      await expect(service.getWindow(10, 10)).resolves.toEqual([]);
    });
  });

  describe('deleteByUserId', (): void => {
    it('should delete all rows of the user', async (): Promise<void> => {
      await service.deleteByUserId(10);

      expect(repository.delete).toHaveBeenCalledWith({ userId: 10 });
    });
  });
});
