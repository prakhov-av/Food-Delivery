import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { GuestOrdersService } from '../../src/orders/guest-orders.service';
import { GuestSessionsService } from '../../src/guest-sessions/guest-sessions.service';
import { GuestSession } from '../../src/guest-sessions/guest-session.entity';
import { Order } from '../../src/orders/order.entity';
import { Restaurant } from '../../src/restaurants/restaurant.entity';
import { User } from '../../src/users/user.entity';
import { Role } from '../../src/users/enums/role.enum';
import { Status } from '../../src/orders/enums/status.enum';
import { EntityNotFoundException } from '../../src/exceptions/types/entity-not-found.exception';

/**
 * Проверяет работу гостевых заказов с реальной PostgreSQL
 * через репозиторий, сервисы и ограничения сущностей.
 *
 * Тесты используют только созданные ими записи и не очищают
 * таблицы целиком, чтобы не затрагивать другие тестовые данные.
 */
describe('GuestOrdersService (IT)', (): void => {
  let app: INestApplication;

  let guestOrdersService: GuestOrdersService;
  let guestSessionsService: GuestSessionsService;

  let ordersRepository: Repository<Order>;
  let guestSessionsRepository: Repository<GuestSession>;
  let restaurantsRepository: Repository<Restaurant>;
  let usersRepository: Repository<User>;

  const createdOrderIds: number[] = [];
  const createdGuestSessionIds: string[] = [];
  const createdRestaurantIds: number[] = [];
  const createdUserIds: number[] = [];

  let sequence = 0;

  beforeAll(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    guestOrdersService = module.get(GuestOrdersService);
    guestSessionsService = module.get(GuestSessionsService);

    ordersRepository = module.get(getRepositoryToken(Order));
    guestSessionsRepository = module.get(getRepositoryToken(GuestSession));
    restaurantsRepository = module.get(getRepositoryToken(Restaurant));
    usersRepository = module.get(getRepositoryToken(User));
  });

  afterEach(async (): Promise<void> => {
    // Сначала удаляем заказы, чтобы не полагаться на каскадное удаление сессий.
    if (createdOrderIds.length > 0) {
      await ordersRepository.delete({ id: In(createdOrderIds) });
      createdOrderIds.length = 0;
    }

    if (createdGuestSessionIds.length > 0) {
      await guestSessionsRepository.delete({
        id: In(createdGuestSessionIds),
      });
      createdGuestSessionIds.length = 0;
    }

    if (createdUserIds.length > 0) {
      await usersRepository.delete({ id: In(createdUserIds) });
      createdUserIds.length = 0;
    }

    if (createdRestaurantIds.length > 0) {
      await restaurantsRepository.delete({
        id: In(createdRestaurantIds),
      });
      createdRestaurantIds.length = 0;
    }
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  it('returns only orders belonging to the requested guest session', async (): Promise<void> => {
    const guestA = await createGuestSession();
    const guestB = await createGuestSession();
    const restaurant = await createRestaurant();
    const registeredCustomer = await createCustomer();

    const guestOrderA = await createOrder({
      restaurant,
      guestSession: guestA.guestSession,
    });

    const guestOrderB = await createOrder({
      restaurant,
      guestSession: guestB.guestSession,
    });

    const registeredUserOrder = await createOrder({
      restaurant,
      customer: registeredCustomer,
    });

    const ordersForGuestA = await guestOrdersService.getGuestOrders(
      guestA.guestSession.id,
    );

    expect(ordersForGuestA).toHaveLength(1);
    expect(ordersForGuestA[0].id).toBe(guestOrderA.id);
    expect(ordersForGuestA.map((order) => order.id)).not.toContain(
      guestOrderB.id,
    );
    expect(ordersForGuestA.map((order) => order.id)).not.toContain(
      registeredUserOrder.id,
    );

    const ordersForGuestB = await guestOrdersService.getGuestOrders(
      guestB.guestSession.id,
    );

    expect(ordersForGuestB).toHaveLength(1);
    expect(ordersForGuestB[0].id).toBe(guestOrderB.id);
  });

  it('does not expose an order belonging to another guest session', async (): Promise<void> => {
    const guestA = await createGuestSession();
    const guestB = await createGuestSession();
    const restaurant = await createRestaurant();

    const orderB = await createOrder({
      restaurant,
      guestSession: guestB.guestSession,
    });

    await expect(
      guestOrdersService.getGuestOrderWithItemsById(
        orderB.id,
        guestA.guestSession.id,
      ),
    ).rejects.toBeInstanceOf(EntityNotFoundException);

    const orderForOwner =
      await guestOrdersService.getGuestOrderWithItemsById(
        orderB.id,
        guestB.guestSession.id,
      );

    expect(orderForOwner.order.id).toBe(orderB.id);
    expect(orderForOwner.items).toEqual([]);
  });

  it('returns only active and non-closed orders in the current guest orders list', async (): Promise<void> => {
    const guest = await createGuestSession();
    const restaurant = await createRestaurant();

    const currentOrder = await createOrder({
      restaurant,
      guestSession: guest.guestSession,
      status: Status.NEW,
      active: true,
    });

    const completedOrder = await createOrder({
      restaurant,
      guestSession: guest.guestSession,
      status: Status.COMPLETED,
      active: true,
    });

    const cancelledOrder = await createOrder({
      restaurant,
      guestSession: guest.guestSession,
      status: Status.CANCELLED_CUSTOMER,
      active: true,
    });

    const inactiveOrder = await createOrder({
      restaurant,
      guestSession: guest.guestSession,
      status: Status.NEW,
      active: false,
    });

    const currentOrders = await guestOrdersService.getCurrentGuestOrders(
      guest.guestSession.id,
    );

    expect(currentOrders.map((order) => order.id)).toEqual([currentOrder.id]);
    expect(currentOrders.map((order) => order.id)).not.toContain(
      completedOrder.id,
    );
    expect(currentOrders.map((order) => order.id)).not.toContain(
      cancelledOrder.id,
    );
    expect(currentOrders.map((order) => order.id)).not.toContain(
      inactiveOrder.id,
    );
  });

  it('does not return an order owned by a registered customer', async (): Promise<void> => {
    const guest = await createGuestSession();
    const restaurant = await createRestaurant();
    const customer = await createCustomer();

    const registeredOrder = await createOrder({
      restaurant,
      customer,
    });

    await expect(
      guestOrdersService.getGuestOrderWithItemsById(
        registeredOrder.id,
        guest.guestSession.id,
      ),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('keeps guest orders in the database after the guest session is revoked', async (): Promise<void> => {
    const guest = await createGuestSession();
    const restaurant = await createRestaurant();

    const order = await createOrder({
      restaurant,
      guestSession: guest.guestSession,
    });

    await guestSessionsService.revokeSession(guest.token);

    const persistedSession = await guestSessionsRepository.findOneBy({
      id: guest.guestSession.id,
    });

    const persistedOrder = await ordersRepository.findOne({
      where: { id: order.id },
      relations: { guestSession: true },
    });

    expect(persistedSession).not.toBeNull();
    expect(persistedSession!.expiresAt).toBeInstanceOf(Date);
    expect(persistedSession!.expiresAt!.getTime()).toBeLessThanOrEqual(
      Date.now(),
    );

    expect(persistedOrder).not.toBeNull();
    expect(persistedOrder!.guestSession).not.toBeNull();
    expect(persistedOrder!.guestSession!.id).toBe(guest.guestSession.id);

    await expect(
      guestSessionsService.resolveSession(guest.token),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws not-found when the guest session has no active orders', async (): Promise<void> => {
    const guest = await createGuestSession();

    await expect(
      guestOrdersService.getGuestOrders(guest.guestSession.id),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  async function createGuestSession(): Promise<{
    guestSession: GuestSession;
    token: string;
  }> {
    const result = await guestSessionsService.createSession();
    createdGuestSessionIds.push(result.guestSession.id);
    return result;
  }

  async function createRestaurant(): Promise<Restaurant> {
    const suffix = `${Date.now()}-${++sequence}`;
    const restaurant = restaurantsRepository.create({
      name: `Guest orders restaurant ${suffix}`,
      address: `Guest orders address ${suffix}`,
      phone: `+4915${String(sequence).padStart(8, '0')}`,
      email: `guest-orders-${suffix}@test.local`,
      active: true,
    });

    const savedRestaurant = await restaurantsRepository.save(restaurant);
    createdRestaurantIds.push(savedRestaurant.id);

    return savedRestaurant;
  }

  async function createCustomer(): Promise<User> {
    const suffix = `${Date.now()}-${++sequence}`;
    const customer = usersRepository.create({
      name: `Guest orders customer ${suffix}`,
      password: 'test-password-hash',
      email: `guest-customer-${suffix}@test.local`,
      phone: `+4916${String(sequence).padStart(8, '0')}`,
      role: Role.CUSTOMER,
      active: true,
      deletedAt: null,
    });

    const savedCustomer = await usersRepository.save(customer);
    createdUserIds.push(savedCustomer.id);

    return savedCustomer;
  }

  async function createOrder(params: {
    restaurant: Restaurant;
    guestSession?: GuestSession;
    customer?: User;
    status?: Status;
    active?: boolean;
  }): Promise<Order> {
    const order = ordersRepository.create({
      customer: params.customer ?? null,
      courier: null,
      guestSession: params.guestSession ?? null,
      restaurant: params.restaurant,
      status: params.status ?? Status.NEW,
      totalPrice: 19.99,
      active: params.active ?? true,
    });

    const savedOrder = await ordersRepository.save(order);
    createdOrderIds.push(savedOrder.id);

    return savedOrder;
  }
});
