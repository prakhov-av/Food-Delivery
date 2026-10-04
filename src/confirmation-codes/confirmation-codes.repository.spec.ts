import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfirmationCode } from './confirmation-code.entity';
import { ConfirmationCodesRepository } from './confirmation-codes.repository';
import { User } from '../users/user.entity';

describe('ConfirmationCodesRepository', (): void => {
  let repository: ConfirmationCodesRepository;
  let typeOrmRepository: jest.Mocked<Repository<ConfirmationCode>>;

  const USER: User = {
    id: 1,
  } as User;

  const CONFIRMATION_CODE: ConfirmationCode = {
    id: 1,
    value: 'confirmation-code',
    expiration: new Date(Date.now() + 60_000),
    user: USER,
  } as ConfirmationCode;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmationCodesRepository,
        {
          provide: getRepositoryToken(ConfirmationCode),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<ConfirmationCodesRepository>(
      ConfirmationCodesRepository,
    );

    typeOrmRepository = module.get<jest.Mocked<Repository<ConfirmationCode>>>(
      getRepositoryToken(ConfirmationCode),
    );
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('save', (): void => {
    it('should save and return confirmation code', async (): Promise<void> => {
      typeOrmRepository.save.mockResolvedValue(CONFIRMATION_CODE);

      const result: ConfirmationCode = await repository.save(CONFIRMATION_CODE);

      expect(result).toBe(CONFIRMATION_CODE);
      expect(typeOrmRepository.save).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(CONFIRMATION_CODE);
    });

    it('should propagate repository save error', async (): Promise<void> => {
      const error: Error = new Error('Save error');

      typeOrmRepository.save.mockRejectedValue(error);

      await expect(repository.save(CONFIRMATION_CODE)).rejects.toThrow(
        'Save error',
      );

      expect(typeOrmRepository.save).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(CONFIRMATION_CODE);
    });
  });

  describe('findByValue', (): void => {
    it('should return confirmation code with user relation', async (): Promise<void> => {
      typeOrmRepository.findOne.mockResolvedValue(CONFIRMATION_CODE);

      const result: ConfirmationCode | null =
        await repository.findByValue('confirmation-code');

      expect(result).toBe(CONFIRMATION_CODE);
      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          value: 'confirmation-code',
        },
        relations: {
          user: true,
        },
      });
    });

    it('should return null when confirmation code does not exist', async (): Promise<void> => {
      typeOrmRepository.findOne.mockResolvedValue(null);

      const result: ConfirmationCode | null =
        await repository.findByValue('missing-code');

      expect(result).toBeNull();
      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          value: 'missing-code',
        },
        relations: {
          user: true,
        },
      });
    });

    it('should propagate repository findOne error', async (): Promise<void> => {
      const error: Error = new Error('Find by value error');

      typeOrmRepository.findOne.mockRejectedValue(error);

      await expect(repository.findByValue('confirmation-code')).rejects.toThrow(
        'Find by value error',
      );

      expect(typeOrmRepository.findOne).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOne).toHaveBeenCalledWith({
        where: {
          value: 'confirmation-code',
        },
        relations: {
          user: true,
        },
      });
    });
  });

  describe('delete', (): void => {
    it('should delete confirmation code', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 1,
        raw: {},
      });

      await repository.delete(CONFIRMATION_CODE);

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith(CONFIRMATION_CODE);
    });

    it('should complete successfully when confirmation code does not exist', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 0,
        raw: {},
      });

      await expect(
        repository.delete(CONFIRMATION_CODE),
      ).resolves.toBeUndefined();

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith(CONFIRMATION_CODE);
    });

    it('should propagate repository delete error', async (): Promise<void> => {
      const error: Error = new Error('Delete error');

      typeOrmRepository.delete.mockRejectedValue(error);

      await expect(repository.delete(CONFIRMATION_CODE)).rejects.toThrow(
        'Delete error',
      );

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith(CONFIRMATION_CODE);
    });
  });

  describe('deleteByUser', (): void => {
    it('should delete all confirmation codes for the user', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 1,
        raw: {},
      });

      await repository.deleteByUser(USER);

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith({
        user: {
          id: USER.id,
        },
      });
    });

    it('should complete successfully when user has no confirmation codes', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 0,
        raw: {},
      });

      await expect(repository.deleteByUser(USER)).resolves.toBeUndefined();

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith({
        user: {
          id: USER.id,
        },
      });
    });

    it('should propagate repository deleteByUser error', async (): Promise<void> => {
      const error: Error = new Error('Delete by user error');

      typeOrmRepository.delete.mockRejectedValue(error);

      await expect(repository.deleteByUser(USER)).rejects.toThrow(
        'Delete by user error',
      );

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith({
        user: {
          id: USER.id,
        },
      });
    });
  });
});
