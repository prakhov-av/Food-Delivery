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
import { Menu } from '../../src/menus/menu.entity';
import { MenuItemSaveDto } from '../../src/menu-items/dto/menu-item.save-dto';
import { MenuItemUpdateDto } from '../../src/menu-items/dto/menu-item.update-dto';
import { MenuItem } from '../../src/menu-items/menu-item.entity';

describe('MenuItemsController (IT)', (): void => {
  const RESOURCE_NAME: string = '/menu-items';

  const VALID_SAVE_DTO: MenuItemSaveDto = {
    menuId: 0,
    name: 'MenuItem Name',
    description: 'Description',
    price: 100,
  };

  const VALID_UPDATE_DTO: MenuItemUpdateDto = {
    newName: 'New MenuItem Name',
  };

  const SAVE_DTO_WITH_INCORRECT_NAME: MenuItemSaveDto = {
    menuId: 0,
    name: 'Men&Item',
    description: 'Description',
    price: 100,
  };

  const SAVE_DTO_WITH_INCORRECT_DESCRIPTION: MenuItemSaveDto = {
    menuId: 0,
    name: 'MenuItem',
    description: 'D',
    price: 100,
  };

  const SAVE_DTO_WITH_INCORRECT_PRICE: MenuItemSaveDto = {
    menuId: 0,
    name: 'MenuItem',
    description: 'Description',
    price: 0,
  };

  const UPDATE_DTO_WITH_INCORRECT_NAME: MenuItemUpdateDto = {
    newName: 'New Men&Item Name',
    newDescription: 'Description',
    newPrice: 100,
  };

  const VALID_SAVE_DTO_WITH_INVALID_MENU_ID: MenuItemSaveDto = {
    name: 'MenuItem Name',
    description: 'Description',
    price: 100,
    menuId: 0,
  };

  const VALID_SAVE_DTO_WITH_NOT_EXISTING_MENU: MenuItemSaveDto = {
    name: 'MenuItem Name',
    description: 'Description',
    price: 100.0,
    menuId: 1000000000,
  };

  let app: INestApplication;
  let httpServer: any;
  let activeMenu: Menu;
  let inactiveMenu: Menu;
  let menuWithoutItems: Menu;
  let activeMenuItem: MenuItem;
  let inactiveMenuItem: MenuItem;
  let activeRestaurant: Restaurant;
  let inactiveRestaurant: Restaurant;
  let restaurantWithoutItems: Restaurant;
  let repository: Repository<MenuItem>;
  let menusRepository: Repository<Menu>;
  let restaurantsRepository: Repository<Restaurant>;

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
    repository = module.get(getRepositoryToken(MenuItem));
    menusRepository = module.get(getRepositoryToken(Menu));
    restaurantsRepository = module.get(getRepositoryToken(Restaurant));
  });

  beforeEach(async (): Promise<void> => {
    activeRestaurant = new Restaurant();
    activeRestaurant.name = 'Active Restaurant 1';
    activeRestaurant.address = 'Address 1';
    activeRestaurant.phone = '+380501111111';
    activeRestaurant.email = 'rest1@test.com';
    activeRestaurant.active = true;

    await restaurantsRepository.save(activeRestaurant);

    activeMenu = new Menu();
    activeMenu.name = 'Active Menu';
    activeMenu.restaurant = activeRestaurant;
    activeMenu.items = [];
    activeMenu.active = true;

    await menusRepository.save(activeMenu);

    activeMenuItem = new MenuItem();
    activeMenuItem.name = 'Active MenuItem';
    activeMenuItem.description = 'Description';
    activeMenuItem.price = 100;
    activeMenuItem.menu = activeMenu;

    await repository.save(activeMenuItem);

    inactiveRestaurant = new Restaurant();
    inactiveRestaurant.name = 'Inactive Restaurant';
    inactiveRestaurant.address = 'Address 2';
    inactiveRestaurant.phone = '+380501111112';
    inactiveRestaurant.email = 'rest2@test.com';
    inactiveRestaurant.active = true;

    await restaurantsRepository.save(inactiveRestaurant);

    inactiveMenu = new Menu();
    inactiveMenu.name = 'Inactive Menu';
    inactiveMenu.restaurant = inactiveRestaurant;
    inactiveMenu.items = [];
    inactiveMenu.active = false;

    await menusRepository.save(inactiveMenu);

    inactiveMenuItem = new MenuItem();
    inactiveMenuItem.name = 'Inactive MenuItem';
    inactiveMenuItem.description = 'Description';
    inactiveMenuItem.price = 100;
    inactiveMenuItem.menu = inactiveMenu;
    inactiveMenuItem.active = false;

    await repository.save(inactiveMenuItem);

    restaurantWithoutItems = new Restaurant();
    restaurantWithoutItems.name = 'Restaurant Without Items';
    restaurantWithoutItems.address = 'Address 3';
    restaurantWithoutItems.phone = '+380501111113';
    restaurantWithoutItems.email = 'rest3@test.com';
    restaurantWithoutItems.active = true;

    await restaurantsRepository.save(restaurantWithoutItems);

    menuWithoutItems = new Menu();

    menuWithoutItems.name = 'Menu Without Items';
    menuWithoutItems.restaurant = restaurantWithoutItems;
    menuWithoutItems.items = [];
    menuWithoutItems.active = true;

    await menusRepository.save(menuWithoutItems);

    VALID_SAVE_DTO.menuId = menuWithoutItems.id;

    SAVE_DTO_WITH_INCORRECT_NAME.menuId = menuWithoutItems.id;
    SAVE_DTO_WITH_INCORRECT_DESCRIPTION.menuId = menuWithoutItems.id;
    SAVE_DTO_WITH_INCORRECT_PRICE.menuId = menuWithoutItems.id;

    VALID_SAVE_DTO_WITH_INVALID_MENU_ID.menuId = 0;
    VALID_SAVE_DTO_WITH_NOT_EXISTING_MENU.menuId = 1000000000;
  });

  afterEach(async (): Promise<void> => {
    await repository.deleteAll();
    await menusRepository.deleteAll();
    await restaurantsRepository.deleteAll();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  describe('create', (): void => {
    it('should create menu item', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO)
        .expect(HttpStatus.CREATED);

      expect(response.body).toBeDefined();
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: VALID_SAVE_DTO.name,
          description: VALID_SAVE_DTO.description,
          price: VALID_SAVE_DTO.price,
        }),
      );

      const savedMenuItem: MenuItem | null = await repository.findOne({
        where: {
          id: response.body.id,
        },
        relations: {
          menu: true,
        },
      });

      expect(savedMenuItem).toBeDefined();

      expect(savedMenuItem).toEqual(
        expect.objectContaining({
          name: VALID_SAVE_DTO.name,
          description: VALID_SAVE_DTO.description,
          active: true,
        }),
      );

      expect(Number(savedMenuItem?.price)).toBe(VALID_SAVE_DTO.price);
      expect(savedMenuItem?.menu.id).toBe(menuWithoutItems.id);
    });

    it('should return 400 if name is incorrect', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(SAVE_DTO_WITH_INCORRECT_NAME)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Name should contain'),
        ]),
      );
    });

    it('should return 400 if description is incorrect', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(SAVE_DTO_WITH_INCORRECT_DESCRIPTION)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('must be longer')]),
      );
    });

    it('should return 400 if price is incorrect', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(SAVE_DTO_WITH_INCORRECT_PRICE)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('0.01')]),
      );
    });

    it('should return 404 if menu is not found', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(RESOURCE_NAME)
        .send(VALID_SAVE_DTO_WITH_NOT_EXISTING_MENU)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('getById', (): void => {
    it('should return menu item', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .get(`${RESOURCE_NAME}/${activeMenuItem.id}`)
        .expect(HttpStatus.OK);

      expect(response.body).toBeDefined();
      expect(response.body).toEqual(
        expect.objectContaining({
          id: activeMenuItem.id,
          name: activeMenuItem.name,
          description: activeMenuItem.description,
        }),
      );

      expect(Number(response.body.price)).toBe(activeMenuItem.price);
    });

    it('should return 404 if inactive menu item is requested', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .get(`${RESOURCE_NAME}/${inactiveMenuItem.id}`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('update', (): void => {
    it('should update menu item name', async (): Promise<void> => {
      await request(httpServer)
        .patch(`${RESOURCE_NAME}/${activeMenuItem.id}`)
        .send(VALID_UPDATE_DTO)
        .expect(HttpStatus.NO_CONTENT);

      const updatedMenuItem = await repository.findOne({
        where: {
          id: activeMenuItem.id,
        },
        relations: {
          menu: true,
        },
      });

      expect(updatedMenuItem).toBeDefined();
      expect(updatedMenuItem).toEqual(
        expect.objectContaining({
          name: VALID_UPDATE_DTO.newName,
          active: true,
        }),
      );

      expect(updatedMenuItem?.menu.id).toBe(activeMenu.id);
    });

    it('should return 400 if new menu item name is incorrect', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .patch(`${RESOURCE_NAME}/${activeMenuItem.id}`)
        .send(UPDATE_DTO_WITH_INCORRECT_NAME)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('Name')]),
      );

      const existingMenuItem: MenuItem | null = await repository.findOne({
        where: {
          id: activeMenuItem.id,
        },
        relations: {
          menu: true,
        },
      });

      expect(existingMenuItem).toBeDefined();
      expect(existingMenuItem).toEqual(
        expect.objectContaining({
          name: activeMenuItem.name,
          active: true,
        }),
      );

      expect(existingMenuItem?.menu.id).toBe(activeMenu.id);
    });
  });
});
