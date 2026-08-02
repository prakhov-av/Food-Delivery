import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { User } from '../../src/users/user.entity';
import { UsersModule } from '../../src/users/users.module';
import { AuthModule } from '../../src/auth/auth.module';
import { Role } from '../../src/users/enums/role.enum';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../../src/email/email.module';
import { ConfirmationCodesModule } from '../../src/confirmation-codes/confirmation-codes.module';
import { OrdersModule } from '../../src/orders/orders.module';
import { RestaurantsModule } from '../../src/restaurants/restaurants.module';
import { MenusModule } from '../../src/menus/menus.module';
import { MenuItemsModule } from '../../src/menu-items/menu-items.module';
import { OrderItemsModule } from '../../src/order-items/order-items.module';

describe('AuthController (IT)', (): void => {
  const RESOURCE_NAME = '/auth';

  let app: INestApplication;
  let httpServer: any;

  let usersRepository: Repository<User>;

  let confirmedUser: User;
  let unconfirmedUser: User;

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
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        UsersModule,
        RestaurantsModule,
        MenusModule,
        MenuItemsModule,
        OrdersModule,
        OrderItemsModule,
        ConfirmationCodesModule,
        EmailModule,
        AuthModule,
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

    usersRepository = module.get(getRepositoryToken(User));
  });

  beforeEach(async (): Promise<void> => {
    confirmedUser = new User();
    confirmedUser.name = 'John';
    confirmedUser.phone = '+380501111111';
    confirmedUser.email = 'john@test.com';
    confirmedUser.password = await bcrypt.hash('123456', 10);
    confirmedUser.role = Role.CUSTOMER;
    confirmedUser.active = true;

    await usersRepository.save(confirmedUser);

    unconfirmedUser = new User();
    unconfirmedUser.name = 'Mike';
    unconfirmedUser.phone = '+380501111112';
    unconfirmedUser.email = 'mike@test.com';
    unconfirmedUser.password = await bcrypt.hash('123456', 10);
    unconfirmedUser.role = Role.CUSTOMER;
    unconfirmedUser.active = false;

    await usersRepository.save(unconfirmedUser);
  });

  afterEach(async (): Promise<void> => {
    await usersRepository.deleteAll();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  describe('login', (): void => {
    it('should login successfully', async (): Promise<void> => {
      const response: Response = await request(httpServer)
        .post(`${RESOURCE_NAME}/login`)
        .send({
          email: confirmedUser.email,
          password: '123456',
        })
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({});

      expect(response.headers['set-cookie']).toBeDefined();

      const cookies: string[] = response.headers['set-cookie'];

      expect(
        cookies.some((cookie: string): boolean =>
          cookie.startsWith('access-token='),
        ),
      ).toBe(true);

      expect(
        cookies.some((cookie: string): boolean =>
          cookie.startsWith('refresh-token='),
        ),
      ).toBe(true);
    });
  });

  it('should return 401 for wrong password', async (): Promise<void> => {
    await request(httpServer)
      .post(`${RESOURCE_NAME}/login`)
      .send({
        email: confirmedUser.email,
        password: 'wrong-password',
      })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('should return 401 for unknown email', async (): Promise<void> => {
    await request(httpServer)
      .post(`${RESOURCE_NAME}/login`)
      .send({
        email: 'unknown@test.com',
        password: '123456',
      })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('should return 401 for inactive user', async (): Promise<void> => {
    await request(httpServer)
      .post(`${RESOURCE_NAME}/login`)
      .send({
        email: unconfirmedUser.email,
        password: '123456',
      })
      .expect(HttpStatus.FORBIDDEN);
  });


  it('should refresh access token successfully', async (): Promise<void> => {
    const loginResponse = await request(httpServer)
      .post(`${RESOURCE_NAME}/login`)
      .send({
        email: confirmedUser.email,
        password: '123456',
      })
      .expect(HttpStatus.OK);

    const cookies = loginResponse.headers['set-cookie'];

    const refreshResponse = await request(httpServer)
      .post(`${RESOURCE_NAME}/refresh`)
      .set('Cookie', cookies)
      .expect(HttpStatus.OK);

    expect(refreshResponse.body).toEqual({});

    expect(refreshResponse.headers['set-cookie']).toBeDefined();

    expect(
      refreshResponse.headers['set-cookie'].some((cookie: string) =>
        cookie.startsWith('access-token='),
      ),
    ).toBe(true);
  });

  it('should return 401 when refresh cookie is missing', async (): Promise<void> => {
    await request(httpServer)
      .post(`${RESOURCE_NAME}/refresh`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('should return 401 for invalid refresh token', async (): Promise<void> => {
    await request(httpServer)
      .post(`${RESOURCE_NAME}/refresh`)
      .set('Cookie', ['refresh-token=invalid-token'])
      .expect(HttpStatus.UNAUTHORIZED);
  });


  it('should logout successfully', async (): Promise<void> => {
    const loginResponse = await request(httpServer)
      .post(`${RESOURCE_NAME}/login`)
      .send({
        email: confirmedUser.email,
        password: '123456',
      })
      .expect(HttpStatus.OK);

    const cookies = loginResponse.headers['set-cookie'];

    const logoutResponse = await request(httpServer)
      .post(`${RESOURCE_NAME}/logout`)
      .set('Cookie', cookies)
      .expect(HttpStatus.OK);

    expect(logoutResponse.body).toEqual({});

    expect(logoutResponse.headers['set-cookie']).toBeDefined();

    const logoutCookies: string[] = logoutResponse.headers['set-cookie'];

    expect(
      logoutCookies.some((cookie) => cookie.startsWith('access-token=')),
    ).toBe(true);

    expect(
      logoutCookies.some((cookie) => cookie.startsWith('refresh-token=')),
    ).toBe(true);
  });
});
