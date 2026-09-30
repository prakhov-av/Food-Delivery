import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../../src/app.module';
import { Order } from '../../src/orders/order.entity';
import { OrderSaveDto } from '../../src/orders/dto/order.save-dto';
import { OrderUpdateDto } from '../../src/orders/dto/order.update-dto';
import { Status } from '../../src/orders/enums/status.enum';
import { User } from '../../src/users/user.entity';
import { Role } from '../../src/users/enums/role.enum';
import { Restaurant } from '../../src/restaurants/restaurant.entity';
import { OrderItem } from '../../src/order-items/order-item.entity';

describe('OrdersController (IT)', (): void => {
  const RESOURCE_NAME = '/orders';

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
  let activeManager: User;
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

  let activeCustomerCookies: string[] = [];
  let activeManagerCookies: string[] = [];

  beforeAll(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    httpServer = app.getHttpServer();
    repository = module.get(getRepositoryToken(Order));
    usersRepository = module.get(getRepositoryToken(User));
    restaurantsRepository = module.get(getRepositoryToken(Restaurant));
    orderItemsRepository = module.get(getRepositoryToken(OrderItem));

    await orderItemsRepository.deleteAll();
    await repository.deleteAll();
    await restaurantsRepository.deleteAll();
    await usersRepository.deleteAll();
  });

  beforeEach(async (): Promise<void> => {
    activeCustomer = new User();
    activeCustomer.email = 'active-customer@test.com';
    activeCustomer.password = await bcrypt.hash('ActiveCustomerPass', 10);
    activeCustomer.name = 'Active customer';
    activeCustomer.phone = '+380501111111';
    activeCustomer.role = Role.CUSTOMER;
    activeCustomer.active = true;
    await usersRepository.save(activeCustomer);

    activeManager = new User();
    activeManager.email = 'active-manager@test.com';
    activeManager.password = await bcrypt.hash('ActiveManagerPass', 10);
    activeManager.name = 'Active manager';
    activeManager.phone = '+380501111116';
    activeManager.role = Role.MANAGER;
    activeManager.active = true;
    await usersRepository.save(activeManager);

    activeCourier = new User();
    activeCourier.email = 'active-courier@test.com';
    activeCourier.password = await bcrypt.hash('ActiveCourierPass', 10);
    activeCourier.name = 'Active courier';
    activeCourier.phone = '+380501111112';
    activeCourier.role = Role.COURIER;
    activeCourier.active = true;
    await usersRepository.save(activeCourier);

    secondActiveCourier = new User();
    secondActiveCourier.email = 'second-active-courier@test.com';
    secondActiveCourier.password = await bcrypt.hash('SecondCourierPass', 10);
    secondActiveCourier.name = 'Second courier';
    secondActiveCourier.phone = '+380501111115';
    secondActiveCourier.role = Role.COURIER;
    secondActiveCourier.active = true;
    await usersRepository.save(secondActiveCourier);

    inactiveCustomer = new User();
    inactiveCustomer.email = 'inactive-customer@test.com';
    inactiveCustomer.password = await bcrypt.hash('InactiveCustomerPass', 10);
    inactiveCustomer.name = 'Inactive customer';
    inactiveCustomer.phone = '+380501111113';
    inactiveCustomer.role = Role.CUSTOMER;
    inactiveCustomer.active = false;
    await usersRepository.save(inactiveCustomer);

    inactiveCourier = new User();
    inactiveCourier.email = 'inactive-courier@test.com';
    inactiveCourier.password = await bcrypt.hash('InactiveCourierPass', 10);
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

    const customerLoginResponse = await request(httpServer)
      .post('/auth/login')
      .send({
        email: activeCustomer.email,
        password: 'ActiveCustomerPass',
      })
      .expect(HttpStatus.OK);

    activeCustomerCookies = customerLoginResponse.headers['set-cookie'];

    const managerLoginResponse = await request(httpServer)
      .post('/auth/login')
      .send({
        email: activeManager.email,
        password: 'ActiveManagerPass',
      })
      .expect(HttpStatus.OK);

    activeManagerCookies = managerLoginResponse.headers['set-cookie'];
  });

  afterEach(async (): Promise<void> => {
    await orderItemsRepository.deleteAll();
    await repository.deleteAll();
    await restaurantsRepository.deleteAll();
    await usersRepository.deleteAll();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  describe('create', (): void => {
    it('should create order for authenticated customer without courier assignment', async (): Promise<void> => {
      const saveDto: OrderSaveDto = {
        customerId: activeCustomer.id,
        restaurantId: activeRestaurant.id,
      };

      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .set('Cookie', activeCustomerCookies)
        .send(saveDto)
        .expect(HttpStatus.CREATED);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          customer: expect.objectContaining({
            id: activeCustomer.id,
          }),
          courier: null,
          restaurant: expect.objectContaining({
            id: activeRestaurant.id,
          }),
          status: Status.NEW,
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
          customer: expect.objectContaining({ id: activeCustomer.id }),
          courier: null,
          restaurant: expect.objectContaining({ id: activeRestaurant.id }),
        }),
      );
    });

    it('should return 404 if restaurant is not found', async (): Promise<void> => {
      const saveDto: OrderSaveDto = {
        customerId: activeCustomer.id,
        restaurantId: 100000000,
      };

      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .set('Cookie', activeCustomerCookies)
        .send(saveDto)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });

    it('should use authenticated customer even if another customer id is supplied', async (): Promise<void> => {
      const saveDto: OrderSaveDto = {
        customerId: inactiveCustomer.id,
        restaurantId: activeRestaurant.id,
      };

      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .set('Cookie', activeCustomerCookies)
        .send(saveDto)
        .expect(HttpStatus.CREATED);

      expect(response.body.customer.id).toBe(activeCustomer.id);
      expect(response.body.customer.id).not.toBe(inactiveCustomer.id);
    });

    it('should not assign a courier during customer order creation', async (): Promise<void> => {
      const saveDto = {
        customerId: activeCustomer.id,
        restaurantId: activeRestaurant.id,
        courierId: activeCourier.id,
      };

      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .set('Cookie', activeCustomerCookies)
        .send(saveDto)
        .expect(HttpStatus.CREATED);

      expect(response.body.courier).toBeNull();
    });
  });

  describe('getById', (): void => {
    it('should return order', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .get(`${RESOURCE_NAME}/${activeOrder.id}`)
        .set('Cookie', activeCustomerCookies)
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
        .set('Cookie', activeCustomerCookies)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('update', (): void => {
    it('should update order', async (): Promise<void> => {
      VALID_UPDATE_DTO.courierId = secondActiveCourier.id;

      await request(httpServer)
        .patch(`${RESOURCE_NAME}/${activeOrder.id}`)
        .set('Cookie', activeManagerCookies)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.NO_CONTENT);

      const updatedOrder = await repository.findOne({
        where: { id: activeOrder.id },
        relations: {
          customer: true,
          courier: true,
          restaurant: true,
        },
      });

      expect(updatedOrder).toBeDefined();
      expect(updatedOrder).toEqual(
        expect.objectContaining({
          customer: expect.objectContaining({ id: activeCustomer.id }),
          courier: expect.objectContaining({ id: secondActiveCourier.id }),
          restaurant: expect.objectContaining({ id: activeRestaurant.id }),
        }),
      );
    });

    it('should return 404 if inactive order is updated', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .patch(`${RESOURCE_NAME}/${inactiveOrder.id}`)
        .set('Cookie', activeManagerCookies)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });

    it('should return 404 if courier is not found', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .patch(`${RESOURCE_NAME}/${activeOrder.id}`)
        .set('Cookie', activeManagerCookies)
        .send(VALID_UPDATE_DTO_WITH_NOT_EXISTING_COURIER)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });
});
