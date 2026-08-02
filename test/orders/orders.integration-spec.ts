import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../src/users/users.module';
import request from 'supertest';
import { OrdersModule } from '../../src/orders/orders.module';
import { RestaurantsModule } from '../../src/restaurants/restaurants.module';
import { MenusModule } from '../../src/menus/menus.module';
import { MenuItemsModule } from '../../src/menu-items/menu-items.module';
import { OrderItemsModule } from '../../src/order-items/order-items.module';
import { Restaurant } from '../../src/restaurants/restaurant.entity';
import { OrderSaveDto } from '../../src/orders/dto/order.save-dto';
import { OrderUpdateDto } from '../../src/orders/dto/order.update-dto';
import { Order } from '../../src/orders/order.entity';
import { User } from '../../src/users/user.entity';
import { OrderItem } from '../../src/order-items/order-item.entity';
import { Role } from '../../src/users/enums/role.enum';
import { Status } from '../../src/orders/enums/status.enum';

describe('OrdersController (IT)', (): void => {
  const RESOURCE_NAME: string = '/orders';

  const VALID_SAVE_DTO: OrderSaveDto = {
    customerId: 0,
    courierId: 0,
    restaurantId: 0,
  };

  const VALID_SAVE_DTO_WITH_NOT_EXISTING_CUSTOMER: OrderSaveDto = {
    customerId: 100000000,
    courierId: 0,
    restaurantId: 0,
  };

  const VALID_SAVE_DTO_WITH_NOT_EXISTING_COURIER: OrderSaveDto = {
    customerId: 0,
    courierId: 100000000,
    restaurantId: 0,
  };

  const VALID_SAVE_DTO_WITH_NOT_EXISTING_RESTAURANT: OrderSaveDto = {
    customerId: 0,
    courierId: 0,
    restaurantId: 100000000,
  };

  const VALID_UPDATE_DTO: OrderUpdateDto = {
    status: Status.CREATED,
    courierId: 0,
  };

  const VALID_UPDATE_DTO_WITH_NOT_EXISTING_COURIER: OrderUpdateDto = {
    status: Status.CREATED,
    courierId: 100000000,
  };

  let app: INestApplication;
  let httpServer: any;

  let activeOrder: Order;
  let inactiveOrder: Order;

  let activeCustomer: User;
  let activeCourier: User;
  let secondActiveCourier: User;
  let inactiveCustomer: User;
  let inactiveCourier: User;

  let activeRestaurant: Restaurant;
  let inactiveRestaurant: Restaurant;

  let repository: Repository<Order>;
  let usersRepository: Repository<User>;
  let restaurantsRepository: Repository<Restaurant>;
  let orderItemsRepository: Repository<OrderItem>;

  beforeAll(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'qwerty123',
          database: 'food_delivery',
          autoLoadEntities: true,
          synchronize: true,
        }),
        UsersModule,
        OrdersModule,
        RestaurantsModule,
        MenusModule,
        MenuItemsModule,
        OrderItemsModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    httpServer = app.getHttpServer();
    repository = module.get(getRepositoryToken(Order));
    usersRepository = module.get(getRepositoryToken(User));
    restaurantsRepository = module.get(getRepositoryToken(Restaurant));
    orderItemsRepository = module.get(getRepositoryToken(OrderItem));
  });

  beforeEach(async (): Promise<void> => {
    activeCustomer = new User();
    activeCustomer.email = 'active-customer@test.com';
    activeCustomer.password = 'ActiveCustomerPass';
    activeCustomer.name = 'Active customer';
    activeCustomer.phone = '+380501111111';
    activeCustomer.role = Role.CUSTOMER;
    activeCustomer.active = true;

    await usersRepository.save(activeCustomer);

    activeCourier = new User();
    activeCourier.email = 'active-courier@test.com';
    activeCourier.password = 'ActiveCourierPass';
    activeCourier.name = 'Active courier';
    activeCourier.phone = '+380501111112';
    activeCourier.role = Role.COURIER;
    activeCourier.active = true;

    await usersRepository.save(activeCourier);

    secondActiveCourier = new User();
    secondActiveCourier.email = 'second-active-courier@test.com';
    secondActiveCourier.password = 'SecondCourierPass';
    secondActiveCourier.name = 'Second courier';
    secondActiveCourier.phone = '+380501111115';
    secondActiveCourier.role = Role.COURIER;
    secondActiveCourier.active = true;

    await usersRepository.save(secondActiveCourier);

    inactiveCustomer = new User();
    inactiveCustomer.email = 'inactive-customer@test.com';
    inactiveCustomer.password = 'InactiveCustomerPass';
    inactiveCustomer.name = 'Inactive customer';
    inactiveCustomer.phone = '+380501111113';
    inactiveCustomer.role = Role.CUSTOMER;
    inactiveCustomer.active = false;

    await usersRepository.save(inactiveCustomer);

    inactiveCourier = new User();
    inactiveCourier.email = 'inactive-courier@test.com';
    inactiveCourier.password = 'InactiveCourierPass';
    inactiveCourier.name = 'Inactive courier';
    inactiveCourier.phone = '+380501111114';
    inactiveCourier.role = Role.COURIER;
    inactiveCourier.active = false;

    await usersRepository.save(inactiveCourier);

    activeRestaurant = new Restaurant();
    activeRestaurant.name = 'Active Restaurant';
    activeRestaurant.address = 'Address 1';
    activeRestaurant.phone = '+380502111111';
    activeRestaurant.email = 'active@test.com';
    activeRestaurant.active = true;

    await restaurantsRepository.save(activeRestaurant);

    inactiveRestaurant = new Restaurant();
    inactiveRestaurant.name = 'Inactive Restaurant';
    inactiveRestaurant.address = 'Address 2';
    inactiveRestaurant.phone = '+380502111112';
    inactiveRestaurant.email = 'inactive@test.com';
    inactiveRestaurant.active = false;

    await restaurantsRepository.save(inactiveRestaurant);

    VALID_SAVE_DTO.customerId = activeCustomer.id;
    VALID_SAVE_DTO.courierId = activeCourier.id;
    VALID_SAVE_DTO.restaurantId = activeRestaurant.id;

    VALID_UPDATE_DTO.courierId = activeCourier.id;

    VALID_SAVE_DTO_WITH_NOT_EXISTING_CUSTOMER.courierId = activeCourier.id;
    VALID_SAVE_DTO_WITH_NOT_EXISTING_CUSTOMER.restaurantId =
      activeRestaurant.id;

    VALID_SAVE_DTO_WITH_NOT_EXISTING_COURIER.customerId = activeCustomer.id;
    VALID_SAVE_DTO_WITH_NOT_EXISTING_COURIER.restaurantId = activeRestaurant.id;

    VALID_SAVE_DTO_WITH_NOT_EXISTING_RESTAURANT.customerId = activeCustomer.id;
    VALID_SAVE_DTO_WITH_NOT_EXISTING_RESTAURANT.courierId = activeCourier.id;

    VALID_UPDATE_DTO_WITH_NOT_EXISTING_COURIER.courierId = 100000000;

    activeOrder = new Order();
    activeOrder.customer = activeCustomer;
    activeOrder.courier = activeCourier;
    activeOrder.restaurant = activeRestaurant;
    activeOrder.status = Status.NEW;
    activeOrder.totalPrice = 0;
    activeOrder.active = true;

    await repository.save(activeOrder);

    inactiveOrder = new Order();
    inactiveOrder.customer = inactiveCustomer;
    inactiveOrder.courier = inactiveCourier;
    inactiveOrder.restaurant = inactiveRestaurant;
    inactiveOrder.status = Status.NEW;
    inactiveOrder.totalPrice = 0;
    inactiveOrder.active = false;

    await repository.save(inactiveOrder);
  });

  afterEach(async (): Promise<void> => {
    await repository.deleteAll();
    await restaurantsRepository.deleteAll();
    await usersRepository.deleteAll();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  describe('create', (): void => {
    it('should create order', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO)
        .expect(HttpStatus.CREATED);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          customer: expect.objectContaining({
            id: activeCustomer.id,
          }),
          courier: expect.objectContaining({
            id: activeCourier.id,
          }),
          restaurant: expect.objectContaining({
            id: activeRestaurant.id,
          }),
        }),
      );

      const savedOrder = await repository.findOne({
        where: { id: response.body.id },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });

      expect(savedOrder).not.toBeNull();

      expect(savedOrder).toEqual(
        expect.objectContaining({
          active: true,
          customer: expect.objectContaining({
            id: activeCustomer.id,
          }),
          courier: expect.objectContaining({
            id: activeCourier.id,
          }),
          restaurant: expect.objectContaining({
            id: activeRestaurant.id,
          }),
        }),
      );
    });

    it('should return 404 if restaurant is not found', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO_WITH_NOT_EXISTING_RESTAURANT)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });

    it('should return 404 if customer is not found', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO_WITH_NOT_EXISTING_CUSTOMER)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });

    it('should return 404 if courier is not found', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO_WITH_NOT_EXISTING_COURIER)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('getById', (): void => {
    it('should return order', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .get(`${RESOURCE_NAME}/${activeOrder.id}`)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
      expect(response.body).toEqual(
        expect.objectContaining({
          id: activeOrder.id,
          status: activeOrder.status,
          totalPrice: activeOrder.totalPrice.toFixed(2),
        }),
      );
    });

    it('should return 404 if inactive order is requested', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .get(`${RESOURCE_NAME}/${inactiveOrder.id}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('update', (): void => {
    it('should update order', async (): Promise<void> => {
      VALID_UPDATE_DTO.courierId = secondActiveCourier.id;

      await request(httpServer)
        .patch(`${RESOURCE_NAME}/${activeOrder.id}`)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.NO_CONTENT);

      const updatedOrder: Order | null = await repository.findOne({
        where: {
          id: activeOrder.id,
        },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });

      expect(updatedOrder).toBeDefined();
      expect(updatedOrder).toEqual(
        expect.objectContaining({
          customer: expect.objectContaining({
            id: activeCustomer.id,
          }),
          courier: expect.objectContaining({
            id: secondActiveCourier.id,
          }),
          restaurant: expect.objectContaining({
            id: activeRestaurant.id,
          }),
        }),
      );
    });

    it('should return 404 if inactive order is updated', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .patch(`${RESOURCE_NAME}/${inactiveOrder.id}`)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });

    it('should return 404 if courier is not found', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .patch(`${RESOURCE_NAME}/${activeOrder.id}`)
        .send(VALID_UPDATE_DTO_WITH_NOT_EXISTING_COURIER)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });
});
