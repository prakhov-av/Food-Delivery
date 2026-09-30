import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/users/user.entity';
import { Role } from '../../src/users/enums/role.enum';
import { Restaurant } from '../../src/restaurants/restaurant.entity';
import { MenuSaveDto } from '../../src/menus/dto/menu.save-dto';
import { MenuUpdateDto } from '../../src/menus/dto/menu.update-dto';
import { Menu } from '../../src/menus/menu.entity';
import { MenuItem } from '../../src/menu-items/menu-item.entity';

describe('MenusController (IT)', (): void => {
  const RESOURCE_NAME: string = '/menus';

  const VALID_SAVE_DTO: MenuSaveDto = {
    name: 'Menu Name',
    restaurantId: 0,
  };

  const VALID_SAVE_DTO_WITH_INVALID_ID: MenuSaveDto = {
    name: 'Menu Name',
    restaurantId: 0,
  };

  const VALID_SAVE_DTO_WITH_NOT_EXISTING_RESTAURANT: MenuSaveDto = {
    name: 'Menu Name',
    restaurantId: 100000000,
  };

  const VALID_UPDATE_DTO: MenuUpdateDto = {
    newName: 'New Menu Name',
  };

  const UPDATE_DTO_WITH_INCORRECT_NAME: MenuUpdateDto = {
    newName: 'New Men& Name',
  };

  let app: INestApplication;
  let httpServer: any;
  let usersRepository: Repository<User>;
  const testUsers = new Map<
    Role,
    { user: User; password: string; cookies: string[] }
  >();
  let activeMenu: Menu;
  let inactiveMenu: Menu;
  let activeRestaurant: Restaurant;
  let inactiveRestaurant: Restaurant;
  let repository: Repository<Menu>;
  let restaurantsRepository: Repository<Restaurant>;
  let restaurantWithoutMenu: Restaurant;
  let menuItemsRepository: Repository<MenuItem>;

  beforeAll(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    httpServer = app.getHttpServer();
    usersRepository = module.get(getRepositoryToken(User));

    const password = 'IntegrationTestPass123!';
    for (const role of Object.values(Role)) {
      const suffix = `${Date.now()}-${role.toLowerCase()}`;
      const user = usersRepository.create({
        name: `Integration ${role}`,
        email: `integration-${suffix}@test.local`,
        phone: `+49157${Math.floor(Math.random() * 9000000 + 1000000)}`,
        password: await bcrypt.hash(password, 10),
        role,
        active: true,
        deletedAt: null,
      });
      await usersRepository.save(user);
      testUsers.set(role, { user, password, cookies: [] });
    }

    for (const role of Object.values(Role)) {
      const testUser = testUsers.get(role);
      if (!testUser)
        throw new Error(`Test user for role ${role} was not created`);

      const response = await request(httpServer)
        .post('/auth/login')
        .send({ email: testUser.user.email, password: testUser.password })
        .expect(HttpStatus.OK);

      testUser.cookies = response.headers['set-cookie'] as string[];
      expect(testUser.cookies).toBeDefined();
      expect(
        testUser.cookies.some((cookie: string) =>
          cookie.startsWith('access-token='),
        ),
      ).toBe(true);
    }
    repository = module.get(getRepositoryToken(Menu));
    restaurantsRepository = module.get(getRepositoryToken(Restaurant));
    menuItemsRepository = module.get(getRepositoryToken(MenuItem));
  });

  function authenticatedRequest(role: Role) {
    const testUser = testUsers.get(role);
    if (!testUser || testUser.cookies.length === 0) {
      throw new Error(`Test user with role ${role} is not authenticated`);
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
    activeRestaurant = new Restaurant();
    activeRestaurant.name = 'Active Restaurant';
    activeRestaurant.address = 'Address 1';
    activeRestaurant.phone = '+380501111111';
    activeRestaurant.email = 'active@test.com';
    activeRestaurant.active = true;

    await restaurantsRepository.save(activeRestaurant);

    inactiveRestaurant = new Restaurant();
    inactiveRestaurant.name = 'Inactive Restaurant';
    inactiveRestaurant.address = 'Address 2';
    inactiveRestaurant.phone = '+380501111112';
    inactiveRestaurant.email = 'inactive@test.com';
    inactiveRestaurant.active = false;

    await restaurantsRepository.save(inactiveRestaurant);

    restaurantWithoutMenu = new Restaurant();
    restaurantWithoutMenu.name = 'Restaurant Without Menu';
    restaurantWithoutMenu.address = 'Address 3';
    restaurantWithoutMenu.phone = '+380501111113';
    restaurantWithoutMenu.email = 'without@test.com';
    restaurantWithoutMenu.active = true;

    await restaurantsRepository.save(restaurantWithoutMenu);
    VALID_SAVE_DTO.restaurantId = restaurantWithoutMenu.id;

    activeMenu = new Menu();
    activeMenu.name = 'Active Menu';
    activeMenu.restaurant = activeRestaurant;
    activeMenu.items = [];
    activeMenu.active = true;

    await repository.save(activeMenu);

    inactiveMenu = new Menu();
    inactiveMenu.name = 'Inactive Menu';
    inactiveMenu.restaurant = inactiveRestaurant;
    inactiveMenu.items = [];
    inactiveMenu.active = false;

    await repository.save(inactiveMenu);
  });

  afterEach(async (): Promise<void> => {
    await menuItemsRepository.deleteAll();
    await repository.deleteAll();
    await restaurantsRepository.deleteAll();
  });

  afterAll(async (): Promise<void> => {
    for (const testUser of testUsers.values()) {
      await usersRepository.delete(testUser.user.id);
    }
    await app.close();
  });

  describe('authentication and authorization', (): void => {
    it('should return 401 for unauthenticated request', async (): Promise<void> => {
      await request(httpServer)
        .get(`${RESOURCE_NAME}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 for authenticated customer without required role', async (): Promise<void> => {
      await authenticatedRequest(Role.CUSTOMER)
        .post(RESOURCE_NAME)
        .send({})
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('create', (): void => {
    it('should create menu', async (): Promise<void> => {
      const response: Response = await authenticatedRequest(Role.MANAGER)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO)
        .expect(HttpStatus.CREATED);

      expect(response.body).toBeDefined();
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: VALID_SAVE_DTO.name,
        }),
      );

      const savedMenu: Menu | null = await repository.findOne({
        where: {
          id: response.body.id,
        },
        relations: {
          restaurant: true,
          items: true,
        },
      });

      expect(savedMenu).toBeDefined();
      expect(savedMenu).toEqual(
        expect.objectContaining({
          name: VALID_SAVE_DTO.name,
          restaurant: expect.objectContaining({
            id: restaurantWithoutMenu.id,
          }),
          active: true,
        }),
      );
    });

    it('should return 400 if restaurant id is invalid', async (): Promise<void> => {
      const response: Response = await authenticatedRequest(Role.MANAGER)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO_WITH_INVALID_ID)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('restaurantId')]),
      );
    });

    it('should return 404 if restaurant is not found', async (): Promise<void> => {
      const response: Response = await authenticatedRequest(Role.MANAGER)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO_WITH_NOT_EXISTING_RESTAURANT)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('getById', (): void => {
    it('should return menu', async (): Promise<void> => {
      // /menus/5
      const response: Response = await authenticatedRequest(Role.MANAGER)
        .get(`${RESOURCE_NAME}/${activeMenu.id}`)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
      expect(response.body).toEqual(
        expect.objectContaining({
          id: activeMenu.id,
          name: activeMenu.name,
        }),
      );
    });

    it('should return 404 if inactive menu is requested', async (): Promise<void> => {
      const response: Response = await authenticatedRequest(Role.MANAGER)
        .get(`${RESOURCE_NAME}/${inactiveMenu.id}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('update', (): void => {
    it('should update menu name', async (): Promise<void> => {
      await authenticatedRequest(Role.MANAGER)
        .patch(`${RESOURCE_NAME}/${activeMenu.id}`)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.NO_CONTENT);

      const updatedMenu = await repository.findOne({
        where: {
          id: activeMenu.id,
        },
        relations: {
          restaurant: true,
          items: true,
        },
      });

      expect(updatedMenu).toBeDefined();
      expect(updatedMenu).toEqual(
        expect.objectContaining({
          name: VALID_UPDATE_DTO.newName,
          restaurant: activeMenu.restaurant,
          items: activeMenu.items,
        }),
      );
    });

    it('should return 400 if new menu name is incorrect', async (): Promise<void> => {
      const response = await authenticatedRequest(Role.MANAGER)
        .patch(`${RESOURCE_NAME}/${activeMenu.id}`)
        .send(UPDATE_DTO_WITH_INCORRECT_NAME)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('Name')]),
      );

      const existingMenu: Menu | null = await repository.findOne({
        where: {
          id: activeMenu.id,
        },
        relations: {
          restaurant: true,
          items: true,
        },
      });

      expect(existingMenu).toBeDefined();
      expect(existingMenu).toEqual(
        expect.objectContaining({
          name: activeMenu.name,
          restaurant: activeMenu.restaurant,
          items: activeMenu.items,
          active: true,
        }),
      );
    });
  });
});
