import { ConfirmationCodesService } from './confirmation-codes.service';
import { ConfirmationCodesRepository } from './confirmation-codes.repository';
import { User } from '../users/user.entity';
import { ConfirmationCode } from './confirmation-code.entity';

describe('ConfirmationCodesService', (): void => {
  let service: ConfirmationCodesService;

  const repository = {
    save: jest.fn(),
    findByValue: jest.fn(),
    delete: jest.fn(),
    deleteByUser: jest.fn(),
  } as unknown as jest.Mocked<ConfirmationCodesRepository>;

  beforeEach((): void => {
    jest.clearAllMocks();

    service = new ConfirmationCodesService(repository);
  });

  describe('generateConfirmationCode', (): void => {
    it('should delete previous confirmation codes before creating a new one', async (): Promise<void> => {
      const user = new User();
      user.id = 1;

      repository.deleteByUser.mockResolvedValue(undefined);
      repository.save.mockResolvedValue(undefined);

      const code: string = await service.generateConfirmationCode(user);

      expect(repository.deleteByUser).toHaveBeenCalledTimes(1);
      expect(repository.deleteByUser).toHaveBeenCalledWith(user);

      expect(repository.save).toHaveBeenCalledTimes(1);

      const savedEntity: ConfirmationCode = repository.save.mock.calls[0][0];

      expect(savedEntity.user).toBe(user);
      expect(savedEntity.value).toBe(code);
      expect(savedEntity.expiration).toBeInstanceOf(Date);

      expect(code).toBeTruthy();

      expect(repository.deleteByUser.mock.invocationCallOrder[0]).toBeLessThan(
        repository.save.mock.invocationCallOrder[0],
      );
    });
  });

  describe('validateCodeAndGetUser', (): void => {
    it('should return user and delete confirmation code', async (): Promise<void> => {
      const user = new User();

      const confirmationCode = new ConfirmationCode();
      confirmationCode.user = user;
      confirmationCode.value = 'code';
      confirmationCode.expiration = new Date(Date.now() + 60_000);

      repository.findByValue.mockResolvedValue(confirmationCode);
      repository.delete.mockResolvedValue(undefined);

      const result = await service.validateCodeAndGetUser('code');

      expect(result).toBe(user);
      expect(repository.findByValue).toHaveBeenCalledWith('code');
      expect(repository.delete).toHaveBeenCalledWith(confirmationCode);
    });
  });

  describe('validateCodeAndGetUser', (): void => {
    it('should throw RegistrationException when code is not found', async (): Promise<void> => {
      repository.findByValue.mockResolvedValue(null);

      await expect(service.validateCodeAndGetUser('code')).rejects.toThrow();

      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('should throw RegistrationException when code is expired', async (): Promise<void> => {
      const confirmationCode = new ConfirmationCode();
      confirmationCode.value = 'code';
      confirmationCode.expiration = new Date(Date.now() - 60_000);

      repository.findByValue.mockResolvedValue(confirmationCode);

      await expect(service.validateCodeAndGetUser('code')).rejects.toThrow();

      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
