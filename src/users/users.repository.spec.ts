import { UsersRepository } from './users.repository';
import { User } from './user.entity';

describe('UsersRepository', (): void => {
  let repository: UsersRepository;

  const typeOrmRepository = {
    save: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    delete: jest.fn(),
    existsBy: jest.fn(),
  };

  beforeEach((): void => {
    jest.clearAllMocks();

    repository = new UsersRepository(typeOrmRepository as never);
  });

  describe('save', (): void => {
    it('should save and return user', async (): Promise<void> => {
      const user: User = {
        id: 1,
        name: 'John',
        email: 'john@test.com',
        password: 'hashed-password',
        role: 'customer' as never,
        active: true,
      } as User;

      typeOrmRepository.save.mockResolvedValue(user);

      const result: User = await repository.save(user);

      expect(typeOrmRepository.save).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(user);
      expect(result).toBe(user);
    });

    it('should propagate save error', async (): Promise<void> => {
      const user = { id: 1 } as User;
      const error = new Error('Database save error');

      typeOrmRepository.save.mockRejectedValue(error);

      await expect(repository.save(user)).rejects.toThrow(
        'Database save error',
      );

      expect(typeOrmRepository.save).toHaveBeenCalledWith(user);
    });
  });

  describe('findAllActive', (): void => {
    it('should return active users', async (): Promise<void> => {
      const users: User[] = [
        { id: 1, active: true } as User,
        { id: 2, active: true } as User,
      ];

      typeOrmRepository.findBy.mockResolvedValue(users);

      const result: User[] = await repository.findAllActive();

      expect(typeOrmRepository.findBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findBy).toHaveBeenCalledWith({
        active: true,
      });
      expect(result).toBe(users);
    });

    it('should return empty array when there are no active users', async (): Promise<void> => {
      typeOrmRepository.findBy.mockResolvedValue([]);

      const result: User[] = await repository.findAllActive();

      expect(result).toEqual([]);
      expect(typeOrmRepository.findBy).toHaveBeenCalledWith({
        active: true,
      });
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.findBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.findAllActive()).rejects.toThrow(
        'Database query error',
      );
    });
  });

  describe('findById', (): void => {
    it('should return user by id', async (): Promise<void> => {
      const user: User = {
        id: 10,
        active: true,
      } as User;

      typeOrmRepository.findOneBy.mockResolvedValue(user);

      const result: User | null = await repository.findById(10);

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 10,
      });
      expect(result).toBe(user);
    });

    it('should return null when user does not exist', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockResolvedValue(null);

      const result: User | null = await repository.findById(999);

      expect(result).toBeNull();

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 999,
      });
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.findById(1)).rejects.toThrow(
        'Database query error',
      );
    });
  });

  describe('deleteById', (): void => {
    it('should delete user by id', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 1,
      });

      await repository.deleteById(15);

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith(15);
    });

    it('should complete when user does not exist', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 0,
      });

      await expect(repository.deleteById(999)).resolves.toBeUndefined();

      expect(typeOrmRepository.delete).toHaveBeenCalledWith(999);
    });

    it('should propagate delete error', async (): Promise<void> => {
      typeOrmRepository.delete.mockRejectedValue(
        new Error('Database delete error'),
      );

      await expect(repository.deleteById(1)).rejects.toThrow(
        'Database delete error',
      );
    });
  });

  describe('isEmailExists', (): void => {
    it('should return true when email exists', async (): Promise<void> => {
      typeOrmRepository.existsBy.mockResolvedValue(true);

      const result: boolean =
        await repository.isEmailExists('existing@test.com');

      expect(typeOrmRepository.existsBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.existsBy).toHaveBeenCalledWith({
        email: 'existing@test.com',
      });
      expect(result).toBe(true);
    });

    it('should return false when email does not exist', async (): Promise<void> => {
      typeOrmRepository.existsBy.mockResolvedValue(false);

      const result: boolean =
        await repository.isEmailExists('missing@test.com');

      expect(typeOrmRepository.existsBy).toHaveBeenCalledWith({
        email: 'missing@test.com',
      });
      expect(result).toBe(false);
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.existsBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.isEmailExists('test@test.com')).rejects.toThrow(
        'Database query error',
      );
    });
  });

  describe('findByEmail', (): void => {
    it('should return user by email', async (): Promise<void> => {
      const user: User = {
        id: 20,
        email: 'user@test.com',
        active: true,
      } as User;

      typeOrmRepository.findOneBy.mockResolvedValue(user);

      const result: User | null = await repository.findByEmail('user@test.com');

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        email: 'user@test.com',
      });
      expect(result).toBe(user);
    });

    it('should return null when email is not found', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockResolvedValue(null);

      const result: User | null =
        await repository.findByEmail('missing@test.com');

      expect(result).toBeNull();

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        email: 'missing@test.com',
      });
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.findByEmail('test@test.com')).rejects.toThrow(
        'Database query error',
      );
    });
  });
});
