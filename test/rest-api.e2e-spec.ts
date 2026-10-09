import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ChatService } from '../src/chat/chat.service';
import { ConfirmationCode } from '../src/confirmation-codes/confirmation-code.entity';
import { ConfirmationCodesService } from '../src/confirmation-codes/confirmation-codes.service';
import { EmailService } from '../src/email/email.service';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { MenuItem } from '../src/menu-items/menu-item.entity';
import { Menu } from '../src/menus/menu.entity';
import { OrderItem } from '../src/order-items/order-item.entity';
import { Order } from '../src/orders/order.entity';
import { Restaurant } from '../src/restaurants/restaurant.entity';
import { Role } from '../src/users/enums/role.enum';
import { User } from '../src/users/user.entity';
import { GlobalExceptionHandler } from '../src/exceptions/global-exception-handler';

describe('REST API smoke test', () => {
  const runId = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  const password = 'TesterPass1';
  const phone = (suffix: string): string => `+4915${runId.slice(-7)}${suffix}`;

  let app: INestApplication;
  let httpServer: unknown;
  let adminAgent: request.SuperAgentTest;
  let adminEmail: string;
  let restaurantIdForAuthorizationTest: number;
  let orderIdForAuthorizationTest: number;
  let orderItemIdForAuthorizationTest: number;
  let confirmationCodesService: ConfirmationCodesService;
  let confirmationCode = '';
  let loginIpCounter = 0;

  // Give each login test request a separate IP so the production login throttle
  // does not make unrelated e2e tests depend on their execution order.
  const nextTestIp = (): string => `192.0.2.${++loginIpCounter}`;

  const chatService = {
    generateResponse: jest
      .fn()
      .mockResolvedValue('chat response from test double'),
  };
  const ingestionService = { ingest: jest.fn().mockResolvedValue(undefined) };
  const emailService = {
    sendConfirmationEmail: jest.fn(async (user: User): Promise<void> => {
      confirmationCode =
        await confirmationCodesService.generateConfirmationCode(user);
    }),
  };

  let users: Repository<User>;
  let restaurants: Repository<Restaurant>;
  let menus: Repository<Menu>;
  let menuItems: Repository<MenuItem>;
  let orders: Repository<Order>;
  let orderItems: Repository<OrderItem>;
  let codes: Repository<ConfirmationCode>;

  const created = {
    users: [] as number[],
    restaurants: [] as number[],
    menus: [] as number[],
    menuItems: [] as number[],
    orders: [] as number[],
    orderItems: [] as number[],
  };

  beforeAll(async () => {
    // Allow Supertest requests without Origin in this integration-test environment.
    process.env.CSRF_ALLOW_NO_ORIGIN = 'true';

    // DigitalOcean PostgreSQL requires SSL.
    process.env.DB_SSL = 'true';

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailService)
      .overrideProvider(ChatService)
      .useValue(chatService)
      .overrideProvider(IngestionService)
      .useValue(ingestionService)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    // Keep the e2e error contract identical to the production bootstrap.
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.init();

    // In this e2e-only app, trust the test-provided X-Forwarded-For header
    // so each login can use an isolated client IP. Production bootstrap owns
    // the real proxy configuration.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);

    httpServer = app.getHttpServer();
    users = module.get(getRepositoryToken(User));
    restaurants = module.get(getRepositoryToken(Restaurant));
    menus = module.get(getRepositoryToken(Menu));
    menuItems = module.get(getRepositoryToken(MenuItem));
    orders = module.get(getRepositoryToken(Order));
    orderItems = module.get(getRepositoryToken(OrderItem));
    codes = module.get(getRepositoryToken(ConfirmationCode));
    confirmationCodesService = module.get(ConfirmationCodesService);

    const admin = await users.save({
      email: `rest-admin-${runId}@example.test`,
      password: await bcrypt.hash(password, 10),
      name: 'Rest Tester Admin',
      phone: phone('1'),
      role: Role.ADMIN,
      active: true,
      deletedAt: null,
    });
    created.users.push(admin.id);
    adminEmail = admin.email;

    adminAgent = request.agent(httpServer);
    await adminAgent
      .post('/auth/login')
      .set('X-Forwarded-For', nextTestIp())
      .send({ email: admin.email, password })
      .expect(200);
  });

  afterAll(async () => {
    if (!app) {
      return;
    }

    await deleteByIds(orderItems, created.orderItems);
    await deleteByIds(orders, created.orders);
    await deleteByIds(menuItems, created.menuItems);
    await deleteByIds(menus, created.menus);
    await deleteByIds(restaurants, created.restaurants);
    await deleteByIds(codes, await codeIdsForCreatedUsers());
    await deleteByIds(users, created.users);
    await app.close();
  });

  it('sends a successful HTTP request to every REST endpoint', async () => {
    await request(httpServer).get('/restaurants').expect(401);

    await adminAgent.post('/auth/refresh').expect(200);

    const createdUser = await adminAgent
      .post('/users')
      .send({
        email: `rest-courier-${runId}@example.test`,
        password,
        name: 'Rest Tester Courier',
        phone: phone('2'),
      })
      .expect(201);
    const courierId: number = createdUser.body.id;
    created.users.push(courierId);

    await adminAgent.get('/users').expect(200);
    await adminAgent.get(`/users/${courierId}`).expect(200);
    await adminAgent
      .patch(`/users/${courierId}`)
      .send({ newName: 'Rest Updated Courier' })
      .expect(204);
    await adminAgent.delete(`/users/${courierId}`).expect(204);
    await adminAgent.patch(`/users/${courierId}/restore`).expect(204);
    await adminAgent.patch(`/users/${courierId}/set-role/COURIER`).expect(204);

    const registrationEmail = `rest-customer-${runId}@example.test`;
    await request(httpServer)
      .post('/users/register')
      .send({
        email: registrationEmail,
        password,
        name: 'Rest Tester Customer',
        phone: phone('3'),
      })
      .expect(200);
    const customer = await users.findOneByOrFail({ email: registrationEmail });
    created.users.push(customer.id);
    expect(confirmationCode).not.toEqual('');
    await request(httpServer)
      .get(`/users/confirm/${confirmationCode}`)
      .expect(200);
    const customerOrderAgent = request.agent(httpServer);
    await customerOrderAgent
      .post('/auth/login')
      .set('X-Forwarded-For', nextTestIp())
      .send({ email: registrationEmail, password })
      .expect(200);

    const createdRestaurant = await adminAgent
      .post('/restaurants')
      .send({
        name: 'Rest Tester Restaurant',
        address: 'Tester Street 42',
        phone: phone('4'),
        email: `rest-restaurant-${runId}@example.test`,
      })
      .expect(201);
    const restaurantId: number = createdRestaurant.body.id;
    restaurantIdForAuthorizationTest = restaurantId;
    created.restaurants.push(restaurantId);
    await adminAgent.get('/restaurants').expect(200);
    await adminAgent.get(`/restaurants/${restaurantId}`).expect(200);
    await adminAgent
      .patch(`/restaurants/${restaurantId}`)
      .send({ newName: 'Rest Updated Restaurant' })
      .expect(204);
    await adminAgent.delete(`/restaurants/${restaurantId}`).expect(204);
    await adminAgent.patch(`/restaurants/${restaurantId}/restore`).expect(204);

    const createdMenu = await adminAgent
      .post('/menus')
      .send({ name: 'Rest Tester Menu', restaurantId })
      .expect(201);
    const menuId: number = createdMenu.body.id;
    created.menus.push(menuId);
    await adminAgent.get('/menus').expect(200);
    await adminAgent.get(`/menus/${menuId}`).expect(200);
    await adminAgent
      .patch(`/menus/${menuId}`)
      .send({ newName: 'Rest Updated Menu' })
      .expect(204);
    await adminAgent.delete(`/menus/${menuId}`).expect(204);
    await adminAgent.patch(`/menus/${menuId}/restore`).expect(204);

    const createdMenuItem = await adminAgent
      .post('/menu-items')
      .send({
        name: 'Rest Tester Item',
        description: 'Menu item created by the REST smoke test',
        price: 12.5,
        menuId,
      })
      .expect(201);
    const menuItemId: number = createdMenuItem.body.id;
    created.menuItems.push(menuItemId);
    await adminAgent.get('/menu-items').expect(200);
    await adminAgent.get(`/menu-items/${menuItemId}`).expect(200);
    await adminAgent
      .patch(`/menu-items/${menuItemId}`)
      .send({
        newName: 'Rest Updated Item',
        newDescription: 'Updated menu item created by the REST smoke test',
        newPrice: 15.75,
      })
      .expect(204);
    await adminAgent.delete(`/menu-items/${menuItemId}`).expect(204);
    await adminAgent.patch(`/menu-items/${menuItemId}/restore`).expect(204);

    const createdOrder = await customerOrderAgent
      .post('/orders')
      .send({ customerId: customer.id, restaurantId })
      .expect(201);
    const orderId: number = createdOrder.body.id;
    orderIdForAuthorizationTest = orderId;
    created.orders.push(orderId);
    await adminAgent.get('/orders').expect(200);
    await adminAgent.get(`/orders/${orderId}`).expect(200);
    await adminAgent
      .patch(`/orders/${orderId}`)
      .send({ courierId })
      .expect(204);

    const createdOrderItem = await adminAgent
      .post('/order-items')
      .send({ orderId, menuItemId, quantity: 2 })
      .expect(201);
    const orderItemId: number = createdOrderItem.body.id;
    orderItemIdForAuthorizationTest = orderItemId;
    created.orderItems.push(orderItemId);
    await adminAgent.get('/order-items').expect(200);
    await adminAgent.get(`/order-items/${orderItemId}`).expect(200);
    await adminAgent
      .patch(`/order-items/${orderItemId}`)
      .send({ newQuantity: 3 })
      .expect(204);

    await adminAgent
      .patch(`/orders/${orderId}/set-status/ACCEPTED`)
      .expect(204);

    await adminAgent.delete(`/order-items/${orderItemId}`).expect(204);
    await adminAgent.patch(`/order-items/${orderItemId}/restore`).expect(204);

    await adminAgent
      .post('/chat')
      .send({ message: 'REST smoke test message' })
      .expect(200, 'chat response from test double');
    expect(chatService.generateResponse).toHaveBeenCalled();

    await adminAgent
      .post('/ingestion/upload')
      .field('documentType', 'SYSTEM')
      .field('allowedRoles', 'ADMIN')
      .field('language', 'en')
      .field('documentVersion', '1')
      .field('documentId', `rest-document-${runId}`)
      .attach('file', Buffer.from('REST smoke test document'), 'tester.txt')
      .expect(201);
    expect(ingestionService.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'tester.txt' }),
      expect.objectContaining({ documentId: `rest-document-${runId}` }),
    );

    await adminAgent.post('/auth/logout').expect(200);
  }, 30_000);

  it('returns a consistent error response for validation, authentication, authorization, not-found, and conflict errors', async () => {
    // The preceding smoke test logs out adminAgent; authenticate again for protected error cases.
    await adminAgent
      .post('/auth/login')
      .set('X-Forwarded-For', nextTestIp())
      .send({ email: adminEmail, password })
      .expect(200);

    const unauthenticatedResponse = await request(httpServer)
      .get('/restaurants')
      .expect(401);
    expect(unauthenticatedResponse.body).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        path: '/restaurants',
        status: 401,
        message: expect.any(String),
      }),
    );

    const validationResponse = await adminAgent
      .get('/restaurants/1%20OR%201=1')
      .expect(400);
    expect(validationResponse.body).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        path: '/restaurants/1%20OR%201=1',
        status: 400,
        message: expect.any(String),
      }),
    );

    const customerPassword = 'ErrorContractPass1';
    const customer = await users.save({
      email: `rest-error-contract-${runId}@example.test`,
      password: await bcrypt.hash(customerPassword, 10),
      name: 'REST Error Contract Customer',
      phone: phone('8'),
      role: Role.CUSTOMER,
      active: true,
      deletedAt: null,
    });
    created.users.push(customer.id);

    const customerAgent = request.agent(httpServer);
    await customerAgent
      .post('/auth/login')
      .set('X-Forwarded-For', nextTestIp())
      .send({ email: customer.email, password: customerPassword })
      .expect(200);

    const forbiddenResponse = await customerAgent.get('/users').expect(403);
    expect(forbiddenResponse.body).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        path: '/users',
        status: 403,
        message: expect.any(String),
      }),
    );

    const notFoundResponse = await adminAgent
      .get('/users/2147483000')
      .expect(404);
    expect(notFoundResponse.body).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        path: '/users/2147483000',
        status: 404,
        message: expect.any(String),
      }),
    );

    const conflictResponse = await adminAgent
      .post('/users')
      .send({
        email: adminEmail,
        password,
        name: 'Duplicate REST Admin',
        phone: phone('9'),
      })
      .expect(409);
    expect(conflictResponse.body).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        path: '/users',
        status: 409,
        message: expect.any(String),
      }),
    );
  });

  it('hides unexpected server error details from the HTTP response', async () => {
    // Keep this test independent of authentication state left by previous tests.
    await adminAgent
      .post('/auth/login')
      .set('X-Forwarded-For', nextTestIp())
      .send({ email: adminEmail, password })
      .expect(200);

    const internalError = 'sensitive internal test failure';
    chatService.generateResponse.mockRejectedValueOnce(
      new Error(internalError),
    );

    const response = await adminAgent
      .post('/chat')
      .send({ message: 'trigger test error' })
      .expect(500);

    expect(response.body).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        path: '/chat',
        status: 500,
        message: 'Internal server error',
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain(internalError);
  });

  it('validates ingestion multipart DTO and does not call the service for invalid data', async () => {
    await adminAgent
      .post('/auth/login')
      .set('X-Forwarded-For', nextTestIp())
      .send({ email: adminEmail, password })
      .expect(200);

    ingestionService.ingest.mockClear();

    await adminAgent
      .post('/ingestion/upload')
      .field('documentType', 'SYSTEM')
      .field('allowedRoles', 'ADMIN')
      .field('language', 'en')
      .field('documentVersion', '0')
      .field('documentId', `invalid-version-${runId}`)
      .attach('file', Buffer.from('invalid version'), 'tester.txt')
      .expect(400);

    expect(ingestionService.ingest).not.toHaveBeenCalled();

    await adminAgent
      .post('/ingestion/upload')
      .field('documentType', 'SYSTEM')
      .field('allowedRoles', 'NOT_A_ROLE')
      .field('language', 'en')
      .field('documentVersion', '1')
      .field('documentId', `invalid-role-${runId}`)
      .attach('file', Buffer.from('invalid role'), 'tester.txt')
      .expect(400);

    expect(ingestionService.ingest).not.toHaveBeenCalled();
  });

  it('checks JSON input and authorization boundaries for GET, POST, and PATCH', async () => {
    const customerPassword = 'CustomerPass1';
    const customer = await users.save({
      email: `rest-security-customer-${runId}@example.test`,
      password: await bcrypt.hash(customerPassword, 10),
      name: 'Rest Security Customer',
      phone: phone('5'),
      role: Role.CUSTOMER,
      active: true,
      deletedAt: null,
    });
    created.users.push(customer.id);

    const customerAgent = request.agent(httpServer);
    await customerAgent
      .post('/auth/login')
      .set('X-Forwarded-For', nextTestIp())
      .send({ email: customer.email, password: customerPassword })
      .expect(200);

    await customerAgent.get('/users').expect(403);
    await customerAgent.get('/restaurants/1%20OR%201=1').expect(400);
    await customerAgent.get('/orders').expect(404);
    await customerAgent
      .get(`/restaurants/${restaurantIdForAuthorizationTest}`)
      .expect(200);
    await customerAgent
      .post('/restaurants')
      .send({
        name: 'Unauthorized Customer Restaurant',
        address: 'Tester Street 43',
        phone: phone('6'),
        email: `rest-security-restaurant-${runId}@example.test`,
      })
      .expect(403);
    await customerAgent
      .patch(`/restaurants/${restaurantIdForAuthorizationTest}`)
      .send({ newName: 'Customer Changed Restaurant' })
      .expect(403);
    await customerAgent
      .patch(`/orders/${orderIdForAuthorizationTest}/set-status/READY`)
      .expect(403);

    await customerAgent
      .patch(`/order-items/${orderItemIdForAuthorizationTest}`)
      .send({ newQuantity: 2 })
      .expect(403);
    await customerAgent
      .get(`/order-items/${orderItemIdForAuthorizationTest}`)
      .expect(403);
    expect(
      (
        await orderItems.findOneByOrFail({
          id: orderItemIdForAuthorizationTest,
        })
      ).quantity,
    ).toBe(3);

    const refreshedAdminAgent = request.agent(httpServer);
    await refreshedAdminAgent
      .post('/auth/login')
      .set('X-Forwarded-For', nextTestIp())
      .send({ email: adminEmail, password })
      .expect(200);

    await refreshedAdminAgent
      .post('/users')
      .set('Content-Type', 'application/json')
      .send(
        `{\"email\":\"rest-security-input-${runId}@example.test\",\"password\":\"${password}\",\"name\":\"Rest Security Input\",\"phone\":\"${phone('7')}\",\"role\":\"ADMIN\",\"active\":false,\"__proto__\":{\"role\":\"ADMIN\"}}`,
      )
      .expect(400);

    await refreshedAdminAgent
      .patch(`/users/${customer.id}`)
      .send({
        newName: 'Rest Security Updated',
        role: Role.ADMIN,
        active: false,
      })
      .expect(400);
    expect(await users.findOneByOrFail({ id: customer.id })).toMatchObject({
      name: 'Rest Security Customer',
      role: Role.CUSTOMER,
      active: true,
    });

    const chatCallsBeforeInvalidRequest =
      chatService.generateResponse.mock.calls.length;
    await customerAgent
      .post('/chat')
      .send({ message: { $ne: null, oversized: 'unvalidated JSON object' } })
      .expect(400);
    expect(chatService.generateResponse).toHaveBeenCalledTimes(
      chatCallsBeforeInvalidRequest,
    );
  });

  async function deleteByIds<T extends { id: number }>(
    repository: Repository<T>,
    ids: number[],
  ): Promise<void> {
    if (ids.length > 0) {
      await repository.delete(ids);
    }
  }

  async function codeIdsForCreatedUsers(): Promise<number[]> {
    const foundCodes = await codes
      .createQueryBuilder('code')
      .where('code.user_id IN (:...userIds)', { userIds: created.users })
      .select('code.id', 'id')
      .getRawMany<{ id: number }>();
    return foundCodes.map((code) => code.id);
  }
});
