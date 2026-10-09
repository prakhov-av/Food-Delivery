import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { Role } from '../src/users/enums/role.enum';
import { Restaurant } from '../src/restaurants/restaurant.entity';
import { Menu } from '../src/menus/menu.entity';
import { MenuItem } from '../src/menu-items/menu-item.entity';
import { Order } from '../src/orders/order.entity';
import { OrderItem } from '../src/order-items/order-item.entity';
import { GlobalExceptionHandler } from '../src/exceptions/global-exception-handler';

interface TestUser {
  entity: User;
  password: string;
  cookies: string[];
}

describe('Authorization (IT)', () => {
  let app: INestApplication;
  let httpServer: any;

  let usersRepository: Repository<User>;
  let restaurantsRepository: Repository<Restaurant>;
  let menusRepository: Repository<Menu>;
  let menuItemsRepository: Repository<MenuItem>;
  let ordersRepository: Repository<Order>;
  let orderItemsRepository: Repository<OrderItem>;

  const users: TestUser[] = [];
  const createdRestaurantIds: number[] = [];
  const createdMenuIds: number[] = [];
  const createdMenuItemIds: number[] = [];
  const createdOrderIds: number[] = [];
  const createdOrderItemIds: number[] = [];

  beforeAll(async () => {
    // Allow requests without Origin in this integration-test environment.
    // CsrfMiddleware explicitly supports this mode for tests and local tooling.
    process.env.CSRF_ALLOW_NO_ORIGIN = 'true';

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.init();

    httpServer = app.getHttpServer();
    usersRepository = module.get(getRepositoryToken(User));
    restaurantsRepository = module.get(getRepositoryToken(Restaurant));
    menusRepository = module.get(getRepositoryToken(Menu));
    menuItemsRepository = module.get(getRepositoryToken(MenuItem));
    ordersRepository = module.get(getRepositoryToken(Order));
    orderItemsRepository = module.get(getRepositoryToken(OrderItem));

    for (const role of Object.values(Role)) {
      const suffix = `${Date.now()}-${role.toLowerCase()}`;
      const password = 'AuthorizationTestPass123!';
      const user = usersRepository.create({
        name: `Authorization ${role}`,
        email: `authorization-${suffix}@test.local`,
        phone: `+49157${Math.floor(Math.random() * 9000000 + 1000000)}`,
        password: await bcrypt.hash(password, 10),
        role,
        active: true,
        deletedAt: null,
      });

      await usersRepository.save(user);
      users.push({ entity: user, password, cookies: [] });
    }
  });

  afterAll(async () => {
    if (createdOrderItemIds.length > 0) {
      await orderItemsRepository.delete(createdOrderItemIds);
    }
    if (createdOrderIds.length > 0) {
      await ordersRepository.delete(createdOrderIds);
    }
    if (createdMenuItemIds.length > 0) {
      await menuItemsRepository.delete(createdMenuItemIds);
    }
    if (createdMenuIds.length > 0) {
      await menusRepository.delete(createdMenuIds);
    }
    if (createdRestaurantIds.length > 0) {
      await restaurantsRepository.delete(createdRestaurantIds);
    }

    for (const testUser of users) {
      await usersRepository.delete(testUser.entity.id);
    }

    await app.close();
  });

  async function login(testUser: TestUser): Promise<string[]> {
    // Reuse the session cookie to avoid repeatedly hitting the login throttle.
    if (testUser.cookies.length > 0) {
      return testUser.cookies;
    }

    const response = await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.entity.email,
        password: testUser.password,
      })
      .expect(200);

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(
      cookies.some((cookie: string) => cookie.startsWith('access-token=')),
    ).toBe(true);

    testUser.cookies = cookies;
    return cookies;
  }

  function user(role: Role): TestUser {
    const found = users.find((testUser) => testUser.entity.role === role);
    if (!found) {
      throw new Error(`Test user for role ${role} was not created`);
    }
    return found;
  }

  function authenticatedRequest(role: Role) {
    const testUser = users.find((user) => user.entity.role === role);

    if (!testUser) {
      throw new Error(`Test user with role ${role} not found`);
    }

    if (testUser.cookies.length === 0) {
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

  describe('authentication boundary', () => {
    it('returns a consistent error body for an unauthenticated protected endpoint', async () => {
      const response = await request(httpServer)
        .get('/restaurants')
        .expect(401);

      expect(response.body).toEqual(
        expect.objectContaining({
          timestamp: expect.any(String),
          path: '/restaurants',
          status: 401,
          message: expect.any(String),
        }),
      );
      expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
    });

    it.each(Object.values(Role))(
      'authenticates %s through the real login endpoint',
      async (role: Role) => {
        const cookies = await login(user(role));
        expect(
          cookies.some((cookie) => cookie.startsWith('access-token=')),
        ).toBe(true);
      },
    );
  });

  describe('users authorization', () => {
    it('allows manager to read users', async () => {
      await authenticatedRequest(Role.MANAGER).get('/users').expect(200);
    });

    it('allows admin to read users', async () => {
      await authenticatedRequest(Role.ADMIN).get('/users').expect(200);
    });

    it('returns a consistent error body when a customer is forbidden from reading users', async () => {
      await login(user(Role.CUSTOMER));

      const response = await authenticatedRequest(Role.CUSTOMER)
        .get('/users')
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          timestamp: expect.any(String),
          path: '/users',
          status: 403,
          message: expect.any(String),
        }),
      );
    });

    it('returns a consistent error body for validation failures', async () => {
      await login(user(Role.ADMIN));

      const response = await authenticatedRequest(Role.ADMIN)
        .post('/users')
        .send({})
        .expect(400);

      expect(response.body).toEqual(
        expect.objectContaining({
          timestamp: expect.any(String),
          path: '/users',
          status: 400,
          message: expect.any(String),
        }),
      );
      expect(response.body.message.trim().length).toBeGreaterThan(0);
    });

    it('rejects courier with 403', async () => {
      await authenticatedRequest(Role.COURIER).get('/users').expect(403);
    });
  });

  describe('restaurant authorization', () => {
    it('allows manager to create a restaurant', async () => {
      const response = await authenticatedRequest(Role.MANAGER)
        .post('/restaurants')
        .send({
          name: 'Authorization Restaurant',
          address: 'Authorization Test Street 1',
          phone: `+49157${Math.floor(Math.random() * 9000000 + 1000000)}`,
          email: `restaurant-${Date.now()}@test.local`,
        })
        .expect(201);

      createdRestaurantIds.push(response.body.id);
    });

    it('allows admin to create a restaurant', async () => {
      const response = await authenticatedRequest(Role.ADMIN)
        .post('/restaurants')
        .send({
          name: 'Administration Restaurant',
          address: 'Authorization Admin Street 1',
          phone: `+49157${Math.floor(Math.random() * 9000000 + 1000000)}`,
          email: `admin-restaurant-${Date.now()}@test.local`,
        })
        .expect(201);

      createdRestaurantIds.push(response.body.id);
    });

    it.each([Role.CUSTOMER, Role.COURIER])(
      'rejects %s from creating a restaurant with 403',
      async (role: Role) => {
        await authenticatedRequest(role)
          .post('/restaurants')
          .send({})
          .expect(403);
      },
    );
  });

  describe('menu and menu item authorization', () => {
    let restaurantId: number;
    let menuId: number;

    beforeAll(async () => {
      const restaurant = restaurantsRepository.create({
        name: `Fixture Restaurant ${Date.now()}`,
        address: 'Fixture Street 1',
        phone: `+49157${Math.floor(Math.random() * 9000000 + 1000000)}`,
        email: `fixture-${Date.now()}@test.local`,
        active: true,
      });
      await restaurantsRepository.save(restaurant);
      restaurantId = restaurant.id;
      createdRestaurantIds.push(restaurant.id);
    });

    it('allows manager to create a menu', async () => {
      const response = await authenticatedRequest(Role.MANAGER)
        .post('/menus')
        .send({ name: 'Fixture Menu', restaurantId })
        .expect(201);

      menuId = response.body.id;
      createdMenuIds.push(menuId);
    });

    it.each([Role.CUSTOMER, Role.COURIER])(
      'rejects %s from creating a menu with 403',
      async (role: Role) => {
        await authenticatedRequest(role)
          .post('/menus')
          .send({ name: 'Forbidden Menu', restaurantId })
          .expect(403);
      },
    );

    it('allows manager to create a menu item', async () => {
      const response = await authenticatedRequest(Role.MANAGER)
        .post('/menu-items')
        .send({
          name: 'Fixture Item',
          description: 'Authorization test item',
          price: 10,
          menuId,
        })
        .expect(201);

      createdMenuItemIds.push(response.body.id);
    });

    it.each([Role.CUSTOMER, Role.COURIER])(
      'rejects %s from creating a menu item with 403',
      async (role: Role) => {
        await authenticatedRequest(role)
          .post('/menu-items')
          .send({
            name: 'Forbidden Item',
            description: 'Forbidden',
            price: 1,
            menuId,
          })
          .expect(403);
      },
    );
  });

  describe('orders and order items authorization', () => {
    let restaurantId: number;
    let menuId: number;
    let menuItemId: number;

    beforeAll(async () => {
      const restaurant = restaurantsRepository.create({
        name: `Order Fixture Restaurant ${Date.now()}`,
        address: 'Order Fixture Street 1',
        phone: `+49157${Math.floor(Math.random() * 9000000 + 1000000)}`,
        email: `order-fixture-${Date.now()}@test.local`,
        active: true,
      });
      await restaurantsRepository.save(restaurant);
      restaurantId = restaurant.id;
      createdRestaurantIds.push(restaurant.id);

      const menu = menusRepository.create({
        name: `Order Fixture Menu ${Date.now()}`,
        restaurant,
        active: true,
      });
      await menusRepository.save(menu);
      menuId = menu.id;
      createdMenuIds.push(menu.id);

      const menuItem = menuItemsRepository.create({
        name: 'Order Fixture Item',
        description: 'Order authorization fixture',
        price: 10,
        menu,
        active: true,
      });
      await menuItemsRepository.save(menuItem);
      menuItemId = menuItem.id;
      createdMenuItemIds.push(menuItem.id);
    });

    it('allows customer to create an order through the authenticated endpoint', async () => {
      const response = await authenticatedRequest(Role.CUSTOMER)
        .post('/orders')
        .send({
          customerId: user(Role.CUSTOMER).entity.id,
          restaurantId,
        })
        .expect(201);

      createdOrderIds.push(response.body.id);
    });

    it('rejects manager from creating an order with 403', async () => {
      await authenticatedRequest(Role.MANAGER)
        .post('/orders')
        .send({ customerId: user(Role.CUSTOMER).entity.id, restaurantId })
        .expect(403);
    });

    it('allows customer to create an order item for their order', async () => {
      const order = await ordersRepository.findOneByOrFail({
        id: createdOrderIds[0],
      });

      const response = await authenticatedRequest(Role.CUSTOMER)
        .post('/order-items')
        .send({ orderId: order.id, menuItemId, quantity: 1 })
        .expect(201);

      createdOrderItemIds.push(response.body.id);
    });

    it('rejects courier from modifying order items with 403', async () => {
      await authenticatedRequest(Role.COURIER)
        .patch(`/order-items/${createdOrderItemIds[0]}`)
        .send({ newQuantity: 2 })
        .expect(403);
    });
  });

  describe('knowledge base ingestion authorization', () => {
    it('requires authentication', async () => {
      await request(httpServer).post('/ingestion/upload').expect(401);
    });

    it.each([Role.MANAGER, Role.CUSTOMER, Role.COURIER])(
      'rejects %s with 403',
      async (role: Role) => {
        await authenticatedRequest(role).post('/ingestion/upload').expect(403);
      },
    );
  });
});
