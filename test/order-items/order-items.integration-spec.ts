import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../src/users/users.module';
import { RestaurantsModule } from '../../src/restaurants/restaurants.module';
import { MenusModule } from '../../src/menus/menus.module';
import { MenuItemsModule } from '../../src/menu-items/menu-items.module';
import { OrdersModule } from '../../src/orders/orders.module';
import { OrderItemsModule } from '../../src/order-items/order-items.module';
import { User } from '../../src/users/user.entity';
import { Restaurant } from '../../src/restaurants/restaurant.entity';
import { Menu } from '../../src/menus/menu.entity';
import { MenuItem } from '../../src/menu-items/menu-item.entity';
import { Order } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/order-items/order-item.entity';
import { Status } from '../../src/orders/enums/status.enum';
import { OrderItemSaveDto } from '../../src/order-items/dto/order-item.save-dto';
import { OrderItemUpdateDto } from '../../src/order-items/dto/order-item.update-dto';
import { Role } from '../../src/users/enums/role.enum';
import request from 'supertest';

describe('OrderItemsController (IT)', (): void => {
  const RESOURCE_NAME = '/order-items';

  const VALID_SAVE_DTO: OrderItemSaveDto = {
    orderId: 0,
    menuItemId: 0,
    quantity: 2,
  };

  const INVALID_SAVE_DTO: OrderItemSaveDto = {
    orderId: 0,
    menuItemId: 0,
    quantity: 0,
  };

  const VALID_UPDATE_DTO: OrderItemUpdateDto = {
    newQuantity: 5,
  };

  const INVALID_UPDATE_DTO: OrderItemUpdateDto = {
    newQuantity: 0,
  };

  let app: INestApplication;
  let httpServer: any;

  let repository: Repository<OrderItem>;
  let usersRepository: Repository<User>;
  let restaurantsRepository: Repository<Restaurant>;
  let menusRepository: Repository<Menu>;
  let menuItemsRepository: Repository<MenuItem>;
  let ordersRepository: Repository<Order>;

  let customer: User;
  let restaurant: Restaurant;
  let menu: Menu;
  let menuItem: MenuItem;
  let order: Order;

  let activeOrderItem: OrderItem;
  let inactiveOrderItem: OrderItem;

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
        RestaurantsModule,
        MenusModule,
        MenuItemsModule,
        OrdersModule,
        OrderItemsModule,
      ],
    }).compile();

    app = module.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
      }),
    );

    await app.init();

    httpServer = app.getHttpServer();

    repository = module.get(getRepositoryToken(OrderItem));
    usersRepository = module.get(getRepositoryToken(User));
    restaurantsRepository = module.get(getRepositoryToken(Restaurant));
    menusRepository = module.get(getRepositoryToken(Menu));
    menuItemsRepository = module.get(getRepositoryToken(MenuItem));
    ordersRepository = module.get(getRepositoryToken(Order));
  });

  beforeEach(async (): Promise<void> => {
    customer = new User();
    customer.name = 'John';
    customer.phone = '+380501111111';
    customer.email = 'john@test.com';
    customer.password = '123456';
    customer.role = Role.CUSTOMER;
    customer.active = true;

    await usersRepository.save(customer);

    restaurant = new Restaurant();
    restaurant.name = 'Restaurant';
    restaurant.address = 'Address';
    restaurant.phone = '+380501111112';
    restaurant.email = 'restaurant@test.com';
    restaurant.active = true;

    await restaurantsRepository.save(restaurant);

    menu = new Menu();
    menu.name = 'Main Menu';
    menu.restaurant = restaurant;
    menu.items = [];
    menu.active = true;

    await menusRepository.save(menu);

    menuItem = new MenuItem();
    menuItem.name = 'Pizza';
    menuItem.description = 'Pizza1';
    menuItem.price = 200;
    menuItem.menu = menu;
    menuItem.active = true;

    await menuItemsRepository.save(menuItem);

    order = new Order();
    order.customer = customer;
    order.restaurant = restaurant;
    order.status = Status.NEW;
    order.totalPrice = 400;
    order.active = true;

    await ordersRepository.save(order);

    VALID_SAVE_DTO.orderId = order.id;
    VALID_SAVE_DTO.menuItemId = menuItem.id;

    activeOrderItem = new OrderItem();
    activeOrderItem.order = order;
    activeOrderItem.menuItem = menuItem;
    activeOrderItem.quantity = 2;
    activeOrderItem.active = true;

    await repository.save(activeOrderItem);

    inactiveOrderItem = new OrderItem();
    inactiveOrderItem.order = order;
    inactiveOrderItem.menuItem = menuItem;
    inactiveOrderItem.quantity = 1;
    inactiveOrderItem.active = false;

    await repository.save(inactiveOrderItem);
  });

  afterEach(async (): Promise<void> => {
    await repository.deleteAll();
    await ordersRepository.deleteAll();
    await menuItemsRepository.deleteAll();
    await menusRepository.deleteAll();
    await restaurantsRepository.deleteAll();
    await usersRepository.deleteAll();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  describe('create', (): void => {
    it('should create order item', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO)
        .expect(HttpStatus.CREATED);

      expect(response.body).toBeDefined();
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          quantity: VALID_SAVE_DTO.quantity,
        }),
      );

      const savedOrderItem: OrderItem | null = await repository.findOne({
        where: {
          id: response.body.id,
        },
        relations: {
          order: true,
          menuItem: true,
        },
      });

      expect(savedOrderItem).toBeDefined();
      expect(savedOrderItem).toEqual(
        expect.objectContaining({
          quantity: VALID_SAVE_DTO.quantity,
          order: expect.objectContaining({
            id: order.id,
          }),
          menuItem: expect.objectContaining({
            id: menuItem.id,
          }),
          active: true,
        }),
      );
    });

    it('should return 400 if quantity is invalid', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(INVALID_SAVE_DTO)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('quantity'),
        ]),
      );
    });

    it('should return 404 if order is not found', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send({
          ...VALID_SAVE_DTO,
          orderId: 100000000,
        })
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });

    it('should return 404 if menu item is not found', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send({
          ...VALID_SAVE_DTO,
          menuItemId: 100000000,
        })
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });
});
