import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { User } from '../../src/users/user.entity';
import { Role } from '../../src/users/enums/role.enum';
import { UserSaveDto } from '../../src/users/dto/user.save-dto';
import { UserUpdateDto } from '../../src/users/dto/user.update-dto';
import { ThrottlerGuard } from '@nestjs/throttler';

ThrottlerGuard.prototype.canActivate = async () => true;

interface TestUser {
  entity: User;
  password: string;
  cookies: string[];
}

describe('UsersController (IT)', (): void => {
  const RESOURCE_NAME: string = '/users';

  const VALID_SAVE_DTO: UserSaveDto = {
    email: 'users-it-create@test.local',
    password: 'TestUserPass1',
    name: 'Created User',
    phone: '+4915711111111',
  };

  const INVALID_EMAIL_DTO: UserSaveDto = {
    email: 'users-it-invalid-email',
    password: 'TestUserPass1',
    name: 'Created User',
    phone: '+4915711111112',
  };

  const VALID_UPDATE_DTO: UserUpdateDto = {
    newName: 'Updated User Name',
  };

  const INVALID_UPDATE_DTO: UserUpdateDto = {
    newName: 'Invalid#Name',
  };

  let app: INestApplication;
  let httpServer: any;
  let repository: Repository<User>;

  let admin: TestUser;
  let manager: TestUser;
  let customer: TestUser;
  let courier: TestUser;

  const createdUserIds: number[] = [];

  beforeAll(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
      }),
    );

    await app.init();

    httpServer = app.getHttpServer();
    repository = module.get(getRepositoryToken(User));

    const password: string = 'UsersIntegrationPass123!';

    const createTestUser = async (
      role: Role,
      suffix: string,
      phone: string,
    ): Promise<TestUser> => {
      const user: User = repository.create({
        email: `users-it-${suffix}@test.local`,
        password: await bcrypt.hash(password, 10),
        name: `Users IT ${role}`,
        phone,
        role,
        active: true,
        deletedAt: null,
      });

      await repository.save(user);

      return {
        entity: user,
        password,
        cookies: [],
      };
    };

    admin = await createTestUser(Role.ADMIN, 'admin', '+4915700000001');

    manager = await createTestUser(Role.MANAGER, 'manager', '+4915700000002');

    customer = await createTestUser(
      Role.CUSTOMER,
      'customer',
      '+4915700000003',
    );

    courier = await createTestUser(Role.COURIER, 'courier', '+4915700000004');

    createdUserIds.push(
      admin.entity.id,
      manager.entity.id,
      customer.entity.id,
      courier.entity.id,
    );
  });

  afterAll(async (): Promise<void> => {
    if (createdUserIds.length > 0) {
      await repository.delete(createdUserIds);
    }

    await app.close();
  });

  async function login(testUser: TestUser): Promise<string[]> {
    const response = await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.entity.email,
        password: testUser.password,
      })
      .expect(HttpStatus.OK);

    const cookies = response.headers['set-cookie'];

    expect(cookies).toBeDefined();

    expect(
      cookies.some((cookie: string) => cookie.startsWith('access-token=')),
    ).toBe(true);

    testUser.cookies = cookies;

    return cookies;
  }

  function authenticatedRequest(testUser: TestUser) {
    if (testUser.cookies.length === 0) {
      throw new Error(
        `Test user ${testUser.entity.email} has not been authenticated`,
      );
    }

    return {
      get: (path: string) =>
        request(httpServer).get(path).set('Cookie', testUser.cookies),

      post: (path: string) =>
        request(httpServer).post(path).set('Cookie', testUser.cookies),

      patch: (path: string) =>
        request(httpServer).patch(path).set('Cookie', testUser.cookies),

      delete: (path: string) =>
        request(httpServer).delete(path).set('Cookie', testUser.cookies),
    };
  }

  beforeEach(async (): Promise<void> => {
    await login(admin);
    await login(manager);
    await login(customer);
    await login(courier);
  });

  describe('authentication', (): void => {
    it('should return 401 for unauthenticated request', async (): Promise<void> => {
      await request(httpServer)
        .get(RESOURCE_NAME)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('create', (): void => {
    it('should create user for admin', async (): Promise<void> => {
      const response = await authenticatedRequest(admin)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO)
        .expect(HttpStatus.CREATED);

      expect(response.body).toBeDefined();
      expect(response.body.password).toBeUndefined();

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: VALID_SAVE_DTO.name,
          role: Role.CUSTOMER,
        }),
      );

      createdUserIds.push(response.body.id);

      const savedUser: User | null = await repository.findOneBy({
        id: response.body.id,
      });

      expect(savedUser).toBeDefined();

      expect(savedUser).toEqual(
        expect.objectContaining({
          email: VALID_SAVE_DTO.email,
          name: VALID_SAVE_DTO.name,
          role: Role.CUSTOMER,
          active: true,
        }),
      );

      expect(savedUser?.password).not.toBe(VALID_SAVE_DTO.password);

      expect(savedUser?.password).toMatch(/^\$2[aby]\$/);
    });

    it('should return 403 for manager', async (): Promise<void> => {
      await authenticatedRequest(manager)
        .post(RESOURCE_NAME)
        .send({
          ...VALID_SAVE_DTO,
          email: 'users-it-manager-create@test.local',
          phone: '+4915711111113',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for customer', async (): Promise<void> => {
      await authenticatedRequest(customer)
        .post(RESOURCE_NAME)
        .send({
          ...VALID_SAVE_DTO,
          email: 'users-it-customer-create@test.local',
          phone: '+4915711111114',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for courier', async (): Promise<void> => {
      await authenticatedRequest(courier)
        .post(RESOURCE_NAME)
        .send({
          ...VALID_SAVE_DTO,
          email: 'users-it-courier-create@test.local',
          phone: '+4915711111115',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 for invalid email', async (): Promise<void> => {
      await authenticatedRequest(admin)
        .post(RESOURCE_NAME)
        .send(INVALID_EMAIL_DTO)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('getAll', (): void => {
    it('should return active users for admin', async (): Promise<void> => {
      const response = await authenticatedRequest(admin)
        .get(RESOURCE_NAME)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: admin.entity.id,
            role: Role.ADMIN,
          }),
          expect.objectContaining({
            id: manager.entity.id,
            role: Role.MANAGER,
          }),
          expect.objectContaining({
            id: customer.entity.id,
            role: Role.CUSTOMER,
          }),
          expect.objectContaining({
            id: courier.entity.id,
            role: Role.COURIER,
          }),
        ]),
      );

      expect(response.body[0].password).toBeUndefined();
    });

    it('should return active users for manager', async (): Promise<void> => {
      const response = await authenticatedRequest(manager)
        .get(RESOURCE_NAME)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 403 for customer', async (): Promise<void> => {
      await authenticatedRequest(customer)
        .get(RESOURCE_NAME)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for courier', async (): Promise<void> => {
      await authenticatedRequest(courier)
        .get(RESOURCE_NAME)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('getById', (): void => {
    it('should return user for admin', async (): Promise<void> => {
      const response = await authenticatedRequest(admin)
        .get(`${RESOURCE_NAME}/${customer.entity.id}`)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
      expect(response.body.password).toBeUndefined();

      expect(response.body).toEqual(
        expect.objectContaining({
          id: customer.entity.id,
          name: customer.entity.name,
          role: Role.CUSTOMER,
        }),
      );
    });

    it('should return courier for manager', async (): Promise<void> => {
      const response = await authenticatedRequest(manager)
        .get(`${RESOURCE_NAME}/${courier.entity.id}`)
        .expect(HttpStatus.OK);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: courier.entity.id,
          role: Role.COURIER,
        }),
      );
    });

    it('should return 403 for customer', async (): Promise<void> => {
      await authenticatedRequest(customer)
        .get(`${RESOURCE_NAME}/${customer.entity.id}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for courier', async (): Promise<void> => {
      await authenticatedRequest(courier)
        .get(`${RESOURCE_NAME}/${customer.entity.id}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 404 for inactive user', async (): Promise<void> => {
      const inactiveUser: User = repository.create({
        email: 'users-it-inactive@test.local',
        password: await bcrypt.hash('InactivePass123!', 10),
        name: 'Inactive User',
        phone: '+4915711111116',
        role: Role.CUSTOMER,
        active: false,
        deletedAt: new Date(),
      });

      await repository.save(inactiveUser);
      createdUserIds.push(inactiveUser.id);

      await authenticatedRequest(admin)
        .get(`${RESOURCE_NAME}/${inactiveUser.id}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('update', (): void => {
    it('should update user name for admin', async (): Promise<void> => {
      await authenticatedRequest(admin)
        .patch(`${RESOURCE_NAME}/${customer.entity.id}`)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.NO_CONTENT);

      const updatedUser: User | null = await repository.findOneBy({
        id: customer.entity.id,
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.name).toBe(VALID_UPDATE_DTO.newName);
    });

    it('should return 403 for manager', async (): Promise<void> => {
      await authenticatedRequest(manager)
        .patch(`${RESOURCE_NAME}/${customer.entity.id}`)
        .send({
          newName: 'Manager Updated Name',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 for invalid name', async (): Promise<void> => {
      await authenticatedRequest(admin)
        .patch(`${RESOURCE_NAME}/${customer.entity.id}`)
        .send(INVALID_UPDATE_DTO)
        .expect(HttpStatus.BAD_REQUEST);

      const existingUser: User | null = await repository.findOneBy({
        id: customer.entity.id,
      });

      expect(existingUser).toBeDefined();
      expect(existingUser?.name).not.toBe(INVALID_UPDATE_DTO.newName);
    });

    it('should return 403 for customer', async (): Promise<void> => {
      await authenticatedRequest(customer)
        .patch(`${RESOURCE_NAME}/${customer.entity.id}`)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for courier', async (): Promise<void> => {
      await authenticatedRequest(courier)
        .patch(`${RESOURCE_NAME}/${customer.entity.id}`)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('deleteById', (): void => {
    it('should delete user for admin', async (): Promise<void> => {
      const userToDelete: User = repository.create({
        email: 'users-it-delete@test.local',
        password: await bcrypt.hash('DeletePass123!', 10),
        name: 'Delete User',
        phone: '+4915711111117',
        role: Role.CUSTOMER,
        active: true,
        deletedAt: null,
      });

      await repository.save(userToDelete);
      createdUserIds.push(userToDelete.id);

      await authenticatedRequest(admin)
        .delete(`${RESOURCE_NAME}/${userToDelete.id}`)
        .expect(HttpStatus.NO_CONTENT);

      const deletedUser: User | null = await repository.findOneBy({
        id: userToDelete.id,
      });

      expect(deletedUser).toBeDefined();
      expect(deletedUser?.active).toBe(false);
      expect(deletedUser?.deletedAt).toBeDefined();
    });

    it('should return 403 for manager', async (): Promise<void> => {
      await authenticatedRequest(manager)
        .delete(`${RESOURCE_NAME}/${customer.entity.id}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for customer', async (): Promise<void> => {
      await authenticatedRequest(customer)
        .delete(`${RESOURCE_NAME}/${customer.entity.id}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for courier', async (): Promise<void> => {
      await authenticatedRequest(courier)
        .delete(`${RESOURCE_NAME}/${customer.entity.id}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('restoreById', (): void => {
    it('should restore inactive user for admin', async (): Promise<void> => {
      const inactiveUser: User = repository.create({
        email: 'users-it-restore@test.local',
        password: await bcrypt.hash('RestorePass123!', 10),
        name: 'Restore User',
        phone: '+4915711111118',
        role: Role.CUSTOMER,
        active: false,
        deletedAt: new Date(),
      });

      await repository.save(inactiveUser);
      createdUserIds.push(inactiveUser.id);

      await authenticatedRequest(admin)
        .patch(`${RESOURCE_NAME}/${inactiveUser.id}/restore`)
        .expect(HttpStatus.NO_CONTENT);

      const restoredUser: User | null = await repository.findOneBy({
        id: inactiveUser.id,
      });

      expect(restoredUser).toBeDefined();
      expect(restoredUser?.active).toBe(true);
      expect(restoredUser?.deletedAt).toBeNull();
    });

    it('should return 403 for manager', async (): Promise<void> => {
      await authenticatedRequest(manager)
        .patch(`${RESOURCE_NAME}/${customer.entity.id}/restore`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for customer', async (): Promise<void> => {
      await authenticatedRequest(customer)
        .patch(`${RESOURCE_NAME}/${customer.entity.id}/restore`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for courier', async (): Promise<void> => {
      await authenticatedRequest(courier)
        .patch(`${RESOURCE_NAME}/${customer.entity.id}/restore`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('setRole', (): void => {
    it('should change user role for admin', async (): Promise<void> => {
      const userToChange: User = repository.create({
        email: 'users-it-role@test.local',
        password: await bcrypt.hash('RolePass123!', 10),
        name: 'Role User',
        phone: '+4915711111119',
        role: Role.CUSTOMER,
        active: true,
        deletedAt: null,
      });

      await repository.save(userToChange);
      createdUserIds.push(userToChange.id);

      await authenticatedRequest(admin)
        .patch(`${RESOURCE_NAME}/${userToChange.id}/set-role/${Role.COURIER}`)
        .expect(HttpStatus.NO_CONTENT);

      const updatedUser: User | null = await repository.findOneBy({
        id: userToChange.id,
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.role).toBe(Role.COURIER);
    });

    it('should return 403 for manager', async (): Promise<void> => {
      await authenticatedRequest(manager)
        .patch(
          `${RESOURCE_NAME}/${customer.entity.id}/set-role/${Role.COURIER}`,
        )
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for customer', async (): Promise<void> => {
      await authenticatedRequest(customer)
        .patch(
          `${RESOURCE_NAME}/${customer.entity.id}/set-role/${Role.COURIER}`,
        )
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for courier', async (): Promise<void> => {
      await authenticatedRequest(courier)
        .patch(
          `${RESOURCE_NAME}/${customer.entity.id}/set-role/${Role.COURIER}`,
        )
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 400 when assigning the same role', async (): Promise<void> => {
      await authenticatedRequest(admin)
        .patch(
          `${RESOURCE_NAME}/${customer.entity.id}/set-role/${Role.CUSTOMER}`,
        )
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});
