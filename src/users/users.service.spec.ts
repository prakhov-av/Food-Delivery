import { Test, TestingModule } from '@nestjs/testing';
import { EntitySaveException } from '../exceptions/types/entity-save.exception';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';
import { EntityUpdateException } from '../exceptions/types/entity-update.exception';
import { RegistrationException } from '../exceptions/types/registration.exception';
import { UserIsNotConfirmedException } from '../exceptions/types/user-is-not-confirmed.exception';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UsersMapper } from './dto/users.mapper';
import { EmailService } from '../email/email.service';
import { ConfirmationCodesService } from '../confirmation-codes/confirmation-codes.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.enums';
import { Role } from './enums/role.enum';
import { User } from './user.entity';
import { UserSaveDto } from './dto/user.save-dto';
import { UserUpdateDto } from './dto/user.update-dto';

describe('UsersService', (): void => {
  let service: UsersService;

  let repository: jest.Mocked<UsersRepository>;
  let mapper: jest.Mocked<UsersMapper>;
  let emailService: jest.Mocked<EmailService>;
  let confirmationCodeService: jest.Mocked<ConfirmationCodesService>;
  let audit: jest.Mocked<AuditService>;

  const createUser = (
    overrides: Partial<User> = {},
  ): User => {
    const user = new User();

    user.id = 1;
    user.name = 'John';
    user.password = 'Password1';
    user.email = 'john@test.com';
    user.phone = '+49123456789';
    user.role = Role.CUSTOMER;
    user.active = true;
    user.deletedAt = null;

    Object.assign(user, overrides);

    return user;
  };

  beforeEach(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            save: jest.fn(),
            findAllActive: jest.fn(),
            findById: jest.fn(),
            deleteById: jest.fn(),
            isEmailExists: jest.fn(),
            findByEmail: jest.fn(),
            findAvailableCourier: jest.fn(),
          },
        },
        {
          provide: UsersMapper,
          useValue: {
            mapDtoToEntity: jest.fn(),
            mapEntityToDto: jest.fn(),
            mapEntityListToDtoList: jest.fn(),
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
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    repository = module.get(UsersRepository);
    mapper = module.get(UsersMapper);
    emailService = module.get(EmailService);
    confirmationCodeService = module.get(
      ConfirmationCodesService,
    );
    audit = module.get(AuditService);

    jest.clearAllMocks();
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('should be defined', (): void => {
    expect(service).toBeDefined();
  });

  describe('create', (): void => {
    it('should create a user successfully', async (): Promise<void> => {
      const dto: UserSaveDto = {
        email: 'new@test.com',
        password: 'Password1',
        name: 'John',
        phone: '+49123456789',
      };

      const entity: User = createUser({
        email: dto.email,
        password: dto.password,
        name: dto.name,
        phone: dto.phone,
      });

      const result = {
        id: entity.id,
        name: entity.name,
        role: Role.CUSTOMER,
      } as any;

      repository.isEmailExists.mockResolvedValue(false);
      mapper.mapDtoToEntity.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);
      mapper.mapEntityToDto.mockReturnValue(result);

      jest
        .spyOn(require('bcrypt'), 'hash')
        .mockResolvedValue('hashed-password');

      await expect(service.create(dto)).resolves.toBe(result);

      expect(repository.isEmailExists).toHaveBeenCalledWith(
        dto.email,
      );

      expect(mapper.mapDtoToEntity).toHaveBeenCalledWith(dto);

      expect(entity.password).toBe('hashed-password');
      expect(entity.role).toBe(Role.CUSTOMER);
      expect(entity.active).toBe(true);

      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(entity);
    });

    it('should throw EntitySaveException when email already exists', async (): Promise<void> => {
      const dto: UserSaveDto = {
        email: 'existing@test.com',
        password: 'Password1',
        name: 'John',
        phone: '+49123456789',
      };

      repository.isEmailExists.mockResolvedValue(true);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        EntitySaveException,
      );

      expect(repository.isEmailExists).toHaveBeenCalledWith(
        dto.email,
      );

      expect(mapper.mapDtoToEntity).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllActiveUsers', (): void => {
    it('should return all active users', async (): Promise<void> => {
      const users = [
        createUser({ id: 1 }),
        createUser({ id: 2 }),
      ];

      const result = [
        { id: 1 },
        { id: 2 },
      ] as any;

      repository.findAllActive.mockResolvedValue(users);
      mapper.mapEntityListToDtoList.mockReturnValue(result);

      await expect(service.getAllActiveUsers()).resolves.toBe(
        result,
      );

      expect(repository.findAllActive).toHaveBeenCalledTimes(1);
      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith(
        users,
      );
    });

    it('should filter users by role', async (): Promise<void> => {
      const users = [
        createUser({ id: 1, role: Role.CUSTOMER }),
        createUser({ id: 2, role: Role.COURIER }),
        createUser({ id: 3, role: Role.COURIER }),
      ];

      const couriers = [
        users[1],
        users[2],
      ];

      const result = [
        { id: 2 },
        { id: 3 },
      ] as any;

      repository.findAllActive.mockResolvedValue(users);
      mapper.mapEntityListToDtoList.mockReturnValue(result);

      await expect(
        service.getAllActiveUsers(Role.COURIER),
      ).resolves.toBe(result);

      expect(mapper.mapEntityListToDtoList).toHaveBeenCalledWith(
        couriers,
      );
    });

    it('should throw EntityNotFoundException when no active users exist', async (): Promise<void> => {
      repository.findAllActive.mockResolvedValue([]);

      await expect(
        service.getAllActiveUsers(),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundException when requested role has no users', async (): Promise<void> => {
      const users = [
        createUser({
          role: Role.CUSTOMER,
        }),
      ];

      repository.findAllActive.mockResolvedValue(users);

      await expect(
        service.getAllActiveUsers(Role.COURIER),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityListToDtoList).not.toHaveBeenCalled();
    });
  });

  describe('getActiveUserById', (): void => {
    it('should return an active user', async (): Promise<void> => {
      const user = createUser({ id: 7 });
      const result = { id: 7 } as any;

      repository.findById.mockResolvedValue(user);
      mapper.mapEntityToDto.mockReturnValue(result);

      await expect(
        service.getActiveUserById(7),
      ).resolves.toBe(result);

      expect(repository.findById).toHaveBeenCalledWith(7);
      expect(mapper.mapEntityToDto).toHaveBeenCalledWith(user);
    });

    it('should throw when user does not exist', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getActiveUserById(7),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });

    it('should throw when user is inactive', async (): Promise<void> => {
      const user = createUser({
        id: 7,
        active: false,
      });

      repository.findById.mockResolvedValue(user);

      await expect(
        service.getActiveUserById(7),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(mapper.mapEntityToDto).not.toHaveBeenCalled();
    });
  });

  describe('update', (): void => {
    it('should update user name', async (): Promise<void> => {
      const user = createUser({
        id: 7,
        name: 'Old Name',
      });

      const dto: UserUpdateDto = {
        newName: 'New Name',
      };

      repository.findById.mockResolvedValue(user);
      repository.save.mockResolvedValue(user);

      await expect(
        service.update(7, dto),
      ).resolves.toBeUndefined();

      expect(user.name).toBe('New Name');
      expect(repository.save).toHaveBeenCalledWith(user);
    });

    it('should throw when updating a missing user', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(7, { newName: 'New Name' }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when updating an inactive user', async (): Promise<void> => {
      const user = createUser({
        id: 7,
        active: false,
      });

      repository.findById.mockResolvedValue(user);

      await expect(
        service.update(7, { newName: 'New Name' }),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteById', (): void => {
    it('should deactivate a user', async (): Promise<void> => {
      const user = createUser({
        id: 7,
        active: true,
      });

      repository.findById.mockResolvedValue(user);
      repository.save.mockResolvedValue(user);

      await expect(
        service.deleteById(7, 10),
      ).resolves.toBeUndefined();

      expect(user.active).toBe(false);
      expect(user.deletedAt).toBeInstanceOf(Date);
      expect(repository.save).toHaveBeenCalledWith(user);
    });

    it('should prevent a user from deactivating their own account', async (): Promise<void> => {
      await expect(
        service.deleteById(7, 7),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.findById).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when deleting a missing user', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.deleteById(7, 10),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreById', (): void => {
    it('should restore an inactive user', async (): Promise<void> => {
      const user = createUser({
        id: 7,
        active: false,
        deletedAt: new Date(),
      });

      repository.findById.mockResolvedValue(user);
      repository.save.mockResolvedValue(user);

      await expect(
        service.restoreById(7),
      ).resolves.toBeUndefined();

      expect(user.active).toBe(true);
      expect(user.deletedAt).toBeNull();
      expect(repository.save).toHaveBeenCalledWith(user);
    });

    it('should be idempotent for an already active user', async (): Promise<void> => {
      const user = createUser({
        id: 7,
        active: true,
      });

      repository.findById.mockResolvedValue(user);

      await expect(
        service.restoreById(7),
      ).resolves.toBeUndefined();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when restoring a missing user', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.restoreById(7),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('setRole', (): void => {
    it('should change user role', async (): Promise<void> => {
      const user = createUser({
        id: 7,
        role: Role.CUSTOMER,
      });

      repository.findById.mockResolvedValue(user);
      repository.save.mockResolvedValue(user);

      await expect(
        service.setRole(7, Role.COURIER, 10),
      ).resolves.toBeUndefined();

      expect(user.role).toBe(Role.COURIER);
      expect(repository.save).toHaveBeenCalledWith(user);
    });

    it('should prevent changing own role', async (): Promise<void> => {
      await expect(
        service.setRole(7, Role.COURIER, 7),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.findById).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when assigning the same role', async (): Promise<void> => {
      const user = createUser({
        id: 7,
        role: Role.COURIER,
      });

      repository.findById.mockResolvedValue(user);

      await expect(
        service.setRole(7, Role.COURIER, 10),
      ).rejects.toBeInstanceOf(EntityUpdateException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw when changing role of a missing user', async (): Promise<void> => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.setRole(7, Role.COURIER, 10),
      ).rejects.toBeInstanceOf(EntityNotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getConfirmedByEmail', (): void => {
    it('should return a confirmed user', async (): Promise<void> => {
      const user = createUser({
        email: 'confirmed@test.com',
        active: true,
      });

      repository.findByEmail.mockResolvedValue(user);

      await expect(
        service.getConfirmedByEmail('confirmed@test.com'),
      ).resolves.toBe(user);

      expect(repository.findByEmail).toHaveBeenCalledWith(
        'confirmed@test.com',
      );
    });

    it('should throw when user does not exist', async (): Promise<void> => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(
        service.getConfirmedByEmail('missing@test.com'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should throw when user is not confirmed', async (): Promise<void> => {
      const user = createUser({
        email: 'unconfirmed@test.com',
        active: false,
      });

      repository.findByEmail.mockResolvedValue(user);

      await expect(
        service.getConfirmedByEmail('unconfirmed@test.com'),
      ).rejects.toBeInstanceOf(UserIsNotConfirmedException);
    });
  });

  describe('register', (): void => {
    const dto: UserSaveDto = {
      email: 'register@test.com',
      password: 'Password1',
      name: 'John',
      phone: '+49123456789',
    };

    it('should register a new user', async (): Promise<void> => {
      const user = createUser({
        id: 10,
        email: dto.email,
        active: false,
      });

      repository.findByEmail.mockResolvedValue(null);
      repository.save.mockResolvedValue(user);
      emailService.sendConfirmationEmail.mockResolvedValue(undefined);
      audit.record.mockResolvedValue(undefined);

      jest
        .spyOn(require('bcrypt'), 'hash')
        .mockResolvedValue('hashed-password');

      await expect(service.register(dto)).resolves.toBeUndefined();

      expect(repository.findByEmail).toHaveBeenCalledWith(
        dto.email,
      );

      expect(repository.save).toHaveBeenCalledTimes(1);

      const savedUser = repository.save.mock.calls[0][0];

      expect(savedUser.email).toBe(dto.email);
      expect(savedUser.active).toBe(false);
      expect(savedUser.role).toBe(Role.CUSTOMER);
      expect(savedUser.password).toBe('hashed-password');
      expect(savedUser.name).toBe(dto.name);
      expect(savedUser.phone).toBe(dto.phone);

      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.USER_REGISTERED,
        actorId: savedUser.id,
        actorRole: Role.CUSTOMER,
        entityType: 'User',
        entityId: savedUser.id,
        details: { email: dto.email },
      });

      expect(emailService.sendConfirmationEmail).toHaveBeenCalledWith(
        savedUser,
      );
    });

    it('should update an existing unconfirmed user during registration', async (): Promise<void> => {
      const user = createUser({
        id: 10,
        email: dto.email,
        active: false,
        deletedAt: null,
      });

      repository.findByEmail.mockResolvedValue(user);
      repository.save.mockResolvedValue(user);
      audit.record.mockResolvedValue(undefined);
      emailService.sendConfirmationEmail.mockResolvedValue(undefined);

      jest
        .spyOn(require('bcrypt'), 'hash')
        .mockResolvedValue('new-hashed-password');

      await expect(service.register(dto)).resolves.toBeUndefined();

      expect(repository.save).toHaveBeenCalledWith(user);
      expect(user.role).toBe(Role.CUSTOMER);
      expect(user.password).toBe('new-hashed-password');
      expect(user.name).toBe(dto.name);
      expect(user.phone).toBe(dto.phone);

      expect(emailService.sendConfirmationEmail).toHaveBeenCalledWith(
        user,
      );
    });

    it('should reject registration when active email is already in use', async (): Promise<void> => {
      const user = createUser({
        email: dto.email,
        active: true,
      });

      repository.findByEmail.mockResolvedValue(user);

      await expect(
        service.register(dto),
      ).rejects.toBeInstanceOf(RegistrationException);

      expect(repository.save).not.toHaveBeenCalled();
      expect(emailService.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should reject registration for a deleted inactive account', async (): Promise<void> => {
      const user = createUser({
        email: dto.email,
        active: false,
        deletedAt: new Date(),
      });

      repository.findByEmail.mockResolvedValue(user);

      await expect(
        service.register(dto),
      ).rejects.toBeInstanceOf(RegistrationException);

      expect(repository.save).not.toHaveBeenCalled();
      expect(emailService.sendConfirmationEmail).not.toHaveBeenCalled();
    });
  });

  describe('confirmRegistration', (): void => {
    it('should confirm registration', async (): Promise<void> => {
      const user = createUser({
        id: 15,
        active: false,
        deletedAt: null,
      });

      confirmationCodeService.validateCodeAndGetUser.mockResolvedValue(
        user,
      );

      repository.save.mockResolvedValue(user);
      audit.record.mockResolvedValue(undefined);

      await expect(
        service.confirmRegistration('confirmation-code'),
      ).resolves.toBeUndefined();

      expect(
        confirmationCodeService.validateCodeAndGetUser,
      ).toHaveBeenCalledWith('confirmation-code');

      expect(user.active).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(user);

      expect(audit.record).toHaveBeenCalledWith({
        action: AuditAction.USER_CONFIRMED,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'User',
        entityId: user.id,
      });
    });

    it('should reject confirmation for a deleted account', async (): Promise<void> => {
      const user = createUser({
        id: 15,
        active: false,
        deletedAt: new Date(),
      });

      confirmationCodeService.validateCodeAndGetUser.mockResolvedValue(
        user,
      );

      await expect(
        service.confirmRegistration('confirmation-code'),
      ).rejects.toBeInstanceOf(RegistrationException);

      expect(repository.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('findAvailableCourier', (): void => {
    it('should delegate to repository', async (): Promise<void> => {
      const courier = createUser({
        id: 20,
        role: Role.COURIER,
      });

      repository.findAvailableCourier.mockResolvedValue(courier);

      await expect(
        service.findAvailableCourier(),
      ).resolves.toBe(courier);

      expect(repository.findAvailableCourier).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should return null when repository finds no courier', async (): Promise<void> => {
      repository.findAvailableCourier.mockResolvedValue(null);

      await expect(
        service.findAvailableCourier(),
      ).resolves.toBeNull();
    });
  });
});
