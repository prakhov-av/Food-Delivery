import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersMapper } from './dto/users.mapper';
import { UserSaveDto } from './dto/user.save-dto';
import { UserDto } from './dto/user.dto';
import { Role } from './enums/role.enum';
import { EntitySaveException } from '../exceptions/types/entity-save.exception';
import { User } from './user.entity';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { UserUpdateDto } from './dto/user.update-dto';
import { EmailService } from '../email/email.service';
import { ConfirmationCodesService } from '../confirmation-codes/confirmation-codes.service';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';
import { RegistrationException } from '../exceptions/types/registration.exception';

describe('UsersService', (): void => {
  const VALID_SAVE_DTO: UserSaveDto = {
    email: 'user1@test.com',
    password: 'UserPass1',
    name: 'User1',
  };

  const VALID_SAVE_DTO_WITH_EXISTING_EMAIL: UserSaveDto = {
    email: 'admin@test.com',
    password: 'AdminPass1',
    name: 'Admin',
  };

  const VALID_ENTITY_TO_MOCK_RETURN_1: User = {
    id: 1,
    name: 'User1',
    email: 'user1@test.com',
    phone: '1234567890',
    password: 'UserPass1',
    role: Role.CUSTOMER,
    createdAt: new Date(2026, 7, 21),
    deletedAt: new Date(2026, 7, 21),
    active: true,
    customerOrders: [],
    courierOrders: [],
  };

  const VALID_ENTITY_TO_MOCK_RETURN_2: User = {
    id: 2,
    name: 'User2',
    email: 'user2@test.com',
    phone: '1234567891',
    password: 'UserPass2',
    role: Role.CUSTOMER,
    createdAt: new Date(2026, 7, 21),
    deletedAt: new Date(2026, 7, 21),
    active: true,
    customerOrders: [],
    courierOrders: [],
  };

  const VALID_UPDATE_DTO: UserUpdateDto = {
    newName: 'New User Name',
  };

  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  let emailService: jest.Mocked<EmailService>;
  let confirmationCodesService: jest.Mocked<ConfirmationCodesService>;

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        UsersMapper,
        {
          provide: UsersRepository,
          useValue: {
            save: jest.fn(),
            findAllActive: jest.fn(),
            findById: jest.fn(),
            isEmailExists: jest.fn(),
            findByEmail: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendConfirmationEmail: jest.fn(),
          },
        },
        {
          provide: ConfirmationCodesService,
          useValue: {
            validateCodeAndGetUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(UsersRepository);

    emailService = module.get(EmailService);
    confirmationCodesService = module.get(ConfirmationCodesService);

    repository.isEmailExists.mockImplementation(
      async (email: string): Promise<boolean> => {
        return email === 'admin@test.com';
      },
    );

    repository.findByEmail.mockResolvedValue(null);

    repository.findAllActive.mockImplementation(async (): Promise<User[]> => [
      {
        ...VALID_ENTITY_TO_MOCK_RETURN_1,
        customerOrders: [],
        courierOrders: [],
      },
      {
        ...VALID_ENTITY_TO_MOCK_RETURN_2,
        customerOrders: [],
        courierOrders: [],
      },
    ]);

    repository.save.mockImplementation(
      async (entity: User): Promise<User> => entity,
    );

    repository.findById.mockImplementation(
      async (id: number): Promise<User | null> => {
        if (id === 1) {
          return {
            ...VALID_ENTITY_TO_MOCK_RETURN_1,
            customerOrders: [],
            courierOrders: [],
          };
        }

        if (id === 2) {
          return {
            ...VALID_ENTITY_TO_MOCK_RETURN_2,
            customerOrders: [],
            courierOrders: [],
          };
        }

        return null;
      },
    );
  });

  describe('create', (): void => {
    it('should create active user and return dto', async (): Promise<void> => {
      const result: UserDto = await service.create(VALID_SAVE_DTO);

      expect(result).toBeDefined();
      expect(result.name).toEqual(VALID_SAVE_DTO.name);
      expect(result.role).toEqual(Role.CUSTOMER);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.CUSTOMER, active: true }),
      );
    });

    it('should throw error if email already exists', async (): Promise<void> => {
      const resultPromise: Promise<UserDto> = service.create(
        VALID_SAVE_DTO_WITH_EXISTING_EMAIL,
      );

      await expect(resultPromise).rejects.toThrow('already exists');
      await expect(resultPromise).rejects.toBeInstanceOf(EntitySaveException);
    });
  });

  describe('getAllActiveUsers', (): void => {
    it('should return list of user DTOs', async (): Promise<void> => {
      const result: UserDto[] = await service.getAllActiveUsers();

      expect(result).toBeDefined();
      expect(result.length).toEqual(2);

      const dto1: UserDto = result[0];
      expect(dto1).toBeDefined();
      expect(dto1.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.id);
      expect(dto1.name).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.name);
      expect(dto1.role).toEqual(VALID_ENTITY_TO_MOCK_RETURN_1.role);

      const dto2: UserDto = result[1];
      expect(dto2).toBeDefined();
      expect(dto2.id).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.id);
      expect(dto2.name).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.name);
      expect(dto2.role).toEqual(VALID_ENTITY_TO_MOCK_RETURN_2.role);
    });

    it('should throw error if list of users is empty', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);
      const resultPromise: Promise<UserDto[]> = service.getAllActiveUsers();

      await expect(resultPromise).rejects.toThrow('not a single');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('getActiveUserById', (): void => {
    it('should return active user dto', async (): Promise<void> => {
      const result: UserDto = await service.getActiveUserById(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(VALID_ENTITY_TO_MOCK_RETURN_1.id);
      expect(result.name).toBe(VALID_ENTITY_TO_MOCK_RETURN_1.name);
      expect(result.role).toBe(VALID_ENTITY_TO_MOCK_RETURN_1.role);
    });

    it('should throw EntityNotFoundException if user is not found', async (): Promise<void> => {
      const resultPromise: Promise<UserDto> =
        service.getActiveUserById(1000);

      await expect(resultPromise).rejects.toThrow('not found');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('update', (): void => {
    it('should update user name', async (): Promise<void> => {
      const idToUpdate: number = 1;
      await service.update(idToUpdate, VALID_UPDATE_DTO);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: idToUpdate,
          name: VALID_UPDATE_DTO.newName,
        }),
      );
    });

    it('should throw exception when user is not found', async (): Promise<void> => {
      const resultPromise: Promise<void> = service.update(
        1000,
        VALID_UPDATE_DTO,
      );

      await expect(resultPromise).rejects.toThrow('not found');
      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('deleteById', (): void => {
    it('should mark user as inactive', async (): Promise<void> => {
      await service.deleteById(1);

      expect(repository.findById).toHaveBeenCalledWith(1);

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          active: false,
        }),
      );

      const savedUser: User = repository.save.mock.calls[0][0];

      expect(savedUser.deletedAt).toBeInstanceOf(Date);
    });

    it('should throw EntityNotFoundException if user does not exist', async (): Promise<void> => {
      const resultPromise: Promise<void> = service.deleteById(1000);

      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', (): void => {
    it('should restore inactive user', async (): Promise<void> => {
      const inactiveUser: User = {
        ...VALID_ENTITY_TO_MOCK_RETURN_1,
        active: false,
        deletedAt: new Date(),
      };

      repository.findById.mockResolvedValue(inactiveUser);

      await service.restoreById(inactiveUser.id);

      expect(repository.findById).toHaveBeenCalledWith(inactiveUser.id);

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: inactiveUser.id,
          active: true,
          deletedAt: null,
        }),
      );

      const savedUser: User = repository.save.mock.calls[0][0];

      expect(savedUser.active).toBe(true);
      expect(savedUser.deletedAt).toBeNull();
    });

    it('should do nothing if user is already active', async (): Promise<void> => {
      repository.findById.mockResolvedValue(VALID_ENTITY_TO_MOCK_RETURN_1);

      repository.save.mockClear();

      await service.restoreById(VALID_ENTITY_TO_MOCK_RETURN_1.id);

      expect(repository.findById).toHaveBeenCalledWith(
        VALID_ENTITY_TO_MOCK_RETURN_1.id,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException if user does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      const resultPromise: Promise<void> = service.restoreById(1000);

      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('setRole', (): void => {
    it('should change user role', async (): Promise<void> => {
      await service.setRole(1, Role.ADMIN);

      expect(repository.findById).toHaveBeenCalledWith(1);

      expect(repository.save).toHaveBeenCalledTimes(1);

      const savedUser: User = repository.save.mock.calls[0][0];

      expect(savedUser.id).toBe(1);
      expect(savedUser.role).toBe(Role.ADMIN);
    });

    it('should throw EntityUpdateException if role is already assigned', async (): Promise<void> => {
      const resultPromise: Promise<void> = service.setRole(1, Role.CUSTOMER);

      await expect(resultPromise).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException if user does not exist', async (): Promise<void> => {
      const resultPromise: Promise<void> = service.setRole(1000, Role.ADMIN);

      await expect(resultPromise).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('register', (): void => {
    it('should register new user', async (): Promise<void> => {
      repository.findByEmail = jest.fn().mockResolvedValue(null);

      await service.register(VALID_SAVE_DTO);

      expect(repository.findByEmail).toHaveBeenCalledWith(VALID_SAVE_DTO.email);

      expect(repository.save).toHaveBeenCalledTimes(1);

      const savedUser: User = repository.save.mock.calls[0][0];

      expect(savedUser.email).toBe(VALID_SAVE_DTO.email);
      expect(savedUser.name).toBe(VALID_SAVE_DTO.name);
      expect(savedUser.role).toBe(Role.CUSTOMER);
      expect(savedUser.active).toBe(false);

      expect(savedUser.password).not.toBe(VALID_SAVE_DTO.password);
      expect(savedUser.password.startsWith('$2')).toBe(true);
    });

    it('should send confirmation email after registration', async (): Promise<void> => {
      repository.findByEmail.mockResolvedValue(null);

      await service.register(VALID_SAVE_DTO);

      expect(emailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);

      const sentUser: User =
        emailService.sendConfirmationEmail.mock.calls[0][0];

      expect(sentUser.email).toBe(VALID_SAVE_DTO.email);
      expect(sentUser.active).toBe(false);
    });

    it('should throw RegistrationException if user already exists and is active', async (): Promise<void> => {
      repository.findByEmail.mockResolvedValue({
        ...VALID_ENTITY_TO_MOCK_RETURN_1,
        active: true,
      });

      const resultPromise: Promise<void> = service.register(VALID_SAVE_DTO);

      await expect(resultPromise).rejects.toBeInstanceOf(RegistrationException);

      expect(repository.save).not.toHaveBeenCalled();
      expect(emailService.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should update existing inactive user during registration', async (): Promise<void> => {
      const inactiveUser: User = {
        ...VALID_ENTITY_TO_MOCK_RETURN_1,
        active: false,
        name: 'Old Name',
        phone: '0000000000',
        password: 'old-password',
      };

      repository.findByEmail.mockResolvedValue(inactiveUser);

      await service.register(VALID_SAVE_DTO);

      expect(repository.save).toHaveBeenCalledTimes(1);

      const savedUser: User = repository.save.mock.calls[0][0];

      expect(savedUser.id).toBe(inactiveUser.id);
      expect(savedUser.email).toBe(inactiveUser.email);

      expect(savedUser.name).toBe(VALID_SAVE_DTO.name);
      expect(savedUser.phone).toBe(VALID_SAVE_DTO.phone);

      expect(savedUser.password).not.toBe('old-password');
      expect(savedUser.password).not.toBe(VALID_SAVE_DTO.password);
      expect(savedUser.password.startsWith('$2')).toBe(true);

      expect(savedUser.active).toBe(false);

      expect(emailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmRegistration', (): void => {
    it('should activate user after successful confirmation', async (): Promise<void> => {
      const inactiveUser: User = {
        ...VALID_ENTITY_TO_MOCK_RETURN_1,
        active: false,
      };

      confirmationCodesService.validateCodeAndGetUser.mockResolvedValue(
        inactiveUser,
      );

      await service.confirmRegistration('confirmation-code');

      expect(
        confirmationCodesService.validateCodeAndGetUser,
      ).toHaveBeenCalledWith('confirmation-code');

      expect(repository.save).toHaveBeenCalledTimes(1);

      const savedUser: User = repository.save.mock.calls[0][0];

      expect(savedUser.id).toBe(inactiveUser.id);
      expect(savedUser.active).toBe(true);
    });

    it('should propagate exception if confirmation code is invalid', async (): Promise<void> => {
      confirmationCodesService.validateCodeAndGetUser.mockRejectedValue(
        new Error('Invalid confirmation code'),
      );

      const resultPromise: Promise<void> =
        service.confirmRegistration('invalid-code');

      await expect(resultPromise).rejects.toThrow('Invalid confirmation code');

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('confirmRegistration', (): void => {
    it('should activate user after successful confirmation', async (): Promise<void> => {
      const inactiveUser: User = {
        ...VALID_ENTITY_TO_MOCK_RETURN_1,
        active: false,
      };

      confirmationCodesService.validateCodeAndGetUser.mockResolvedValue(
        inactiveUser,
      );

      await service.confirmRegistration('confirmation-code');

      expect(
        confirmationCodesService.validateCodeAndGetUser,
      ).toHaveBeenCalledWith('confirmation-code');

      expect(repository.save).toHaveBeenCalledTimes(1);

      const savedUser: User = repository.save.mock.calls[0][0];

      expect(savedUser.id).toBe(inactiveUser.id);
      expect(savedUser.active).toBe(true);
    });

    it('should propagate exception if confirmation code is invalid', async (): Promise<void> => {
      confirmationCodesService.validateCodeAndGetUser.mockRejectedValue(
        new Error('Invalid confirmation code'),
      );

      const resultPromise: Promise<void> =
        service.confirmRegistration('invalid-code');

      await expect(resultPromise).rejects.toThrow('Invalid confirmation code');

      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
