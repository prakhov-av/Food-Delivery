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
import { RestaurantSaveDto } from '../../src/restaurants/dto/restaurant.save-dto';
import { RestaurantUpdateDto } from '../../src/restaurants/dto/restaurant.update-dto';
import { Restaurant } from '../../src/restaurants/restaurant.entity';
import { Menu } from '../../src/menus/menu.entity';
import { MenuItem } from '../../src/menu-items/menu-item.entity';

describe('RestaurantsController (IT)', (): void => {
  const RESOURCE_NAME: string = '/restaurants';

  const VALID_SAVE_DTO: RestaurantSaveDto = {
    name: 'Restaurant Name',
    address: 'Address 1',
    phone: '+380679026154',
    email: 'rest@test.com',
  };

  const VALID_SAVE_DTO_WITH_INCORRECT_PHONE: RestaurantSaveDto = {
    name: 'Restaurant Name',
    address: 'Address 1',
    phone: '+3806790261546987421',
    email: 'rest@test.com',
  };

  const VALID_UPDATE_DTO: RestaurantUpdateDto = {
    newName: 'New Restaurant Name',
  };

  const UPDATE_DTO_WITH_INCORRECT_NAME: RestaurantUpdateDto = {
    newName: 'New Resta&rant Name',
  };

  let app: INestApplication;
  let httpServer: any;
  let repository: Repository<Restaurant>;
  let menusRepository: Repository<Menu>;
  let activeRestaurant: Restaurant;
  let inactiveRestaurant: Restaurant;
  let menuItemsRepository: Repository<MenuItem>;

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
    repository = module.get(getRepositoryToken(Restaurant));
    menusRepository = module.get(getRepositoryToken(Menu));
    menuItemsRepository = module.get(getRepositoryToken(MenuItem));
  });

  beforeEach(async (): Promise<void> => {
    activeRestaurant = new Restaurant();
    activeRestaurant.name = 'Active Restaurant 1';
    activeRestaurant.address = 'Address 1';
    activeRestaurant.phone = '+380501111111';
    activeRestaurant.email = 'active1@test.com';
    activeRestaurant.active = true;

    inactiveRestaurant = new Restaurant();
    inactiveRestaurant.name = 'Active Restaurant 2';
    inactiveRestaurant.address = 'Address 2';
    inactiveRestaurant.phone = '+380501111112';
    inactiveRestaurant.email = 'active2@test.com';
    inactiveRestaurant.active = false;

    await repository.save([activeRestaurant, inactiveRestaurant]);
  });

  afterEach(async (): Promise<void> => {
    await menuItemsRepository.deleteAll();
    await menusRepository.deleteAll();
    await repository.deleteAll();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  describe('create', (): void => {
    it('should create restaurant', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO)
        .expect(HttpStatus.CREATED);

      expect(response.body).toBeDefined();
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: VALID_SAVE_DTO.name,
          address: VALID_SAVE_DTO.address,
          phone: VALID_SAVE_DTO.phone,
          email: VALID_SAVE_DTO.email,
        }),
      );

      const savedRestaurant: Restaurant | null = await repository.findOneBy({
        id: response.body.id,
      });

      expect(savedRestaurant).toBeDefined();
      expect(savedRestaurant).toEqual(
        expect.objectContaining({
          name: VALID_SAVE_DTO.name,
          address: VALID_SAVE_DTO.address,
          phone: VALID_SAVE_DTO.phone,
          email: VALID_SAVE_DTO.email,
          active: true,
        }),
      );
    });

    it('should return 400 if phone is incorrect', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO_WITH_INCORRECT_PHONE)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('phone')]),
      );
    });
  });

  describe('getById', (): void => {
    it('should return restaurant', async (): Promise<void> => {
      // /restaurants/5
      const response: Response = await request(httpServer)
        .get(`${RESOURCE_NAME}/${activeRestaurant.id}`)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
      expect(response.body).toEqual(
        expect.objectContaining({
          id: activeRestaurant.id,
          name: activeRestaurant.name,
          address: activeRestaurant.address,
          phone: activeRestaurant.phone,
          email: activeRestaurant.email,
        }),
      );
    });

    it('should return 404 if inactive restaurant is requested', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .get(`${RESOURCE_NAME}/${inactiveRestaurant.id}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('update', (): void => {
    it('should update restaurant name', async (): Promise<void> => {
      await request(httpServer)
        .patch(`${RESOURCE_NAME}/${activeRestaurant.id}`)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.NO_CONTENT);

      const updatedRestaurant: Restaurant | null = await repository.findOneBy({
        id: activeRestaurant.id,
      });

      expect(updatedRestaurant).toBeDefined();
      expect(updatedRestaurant).toEqual(
        expect.objectContaining({
          name: VALID_UPDATE_DTO.newName,
          address: activeRestaurant.address,
          phone: activeRestaurant.phone,
          email: activeRestaurant.email,
          active: true,
        }),
      );
    });

    it('should return 400 if new restaurant name is incorrect', async (): Promise<void> => {
      const response = await request(httpServer)
        .patch(`${RESOURCE_NAME}/${activeRestaurant.id}`)
        .send(UPDATE_DTO_WITH_INCORRECT_NAME)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('Name')]),
      );

      const existingRestaurant: Restaurant | null = await repository.findOneBy({
        id: activeRestaurant.id,
      });

      expect(existingRestaurant).toBeDefined();
      expect(existingRestaurant).toEqual(
        expect.objectContaining({
          name: activeRestaurant.name,
          address: activeRestaurant.address,
          phone: activeRestaurant.phone,
          email: activeRestaurant.email,
          active: true,
        }),
      );
    });
  });
});
