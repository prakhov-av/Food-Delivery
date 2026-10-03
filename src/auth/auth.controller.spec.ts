import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };

  const createResponseMock = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authServiceMock as unknown as AuthService);
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should login and set access and refresh cookies', async () => {
    const dto = {
      email: 'user@test.com',
      password: 'password',
    } as LoginRequestDto;

    const response = createResponseMock();

    authServiceMock.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    await controller.login(dto, response as any);

    expect(authServiceMock.login).toHaveBeenCalledWith(dto);
    expect(response.cookie).toHaveBeenCalledTimes(2);

    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      'access-token',
      'access-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      },
    );

    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      'refresh-token',
      'refresh-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000,
      },
    );
  });

  it('should refresh access token and set only access cookie', async () => {
    const request = {
      headers: {
        cookie: 'refresh-token=refresh',
      },
    };

    const response = createResponseMock();

    authServiceMock.refreshAccessToken.mockResolvedValue('new-access-token');

    await controller.refresh(request as any, response as any);

    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledWith(
      'refresh-token=refresh',
    );

    expect(response.cookie).toHaveBeenCalledTimes(1);

    expect(response.cookie).toHaveBeenCalledWith(
      'access-token',
      'new-access-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      },
    );
  });

  it('should logout, revoke refresh token and clear both cookies', () => {
    const request = {
      headers: {
        cookie: 'refresh-token=refresh',
      },
    };

    const response = createResponseMock();

    controller.logout(request as any, response as any);

    expect(authServiceMock.revokeRefreshToken).toHaveBeenCalledWith(
      'refresh-token=refresh',
    );

    expect(response.clearCookie).toHaveBeenNthCalledWith(1, 'access-token');

    expect(response.clearCookie).toHaveBeenNthCalledWith(2, 'refresh-token');
  });

  it('should use secure cookies and SameSite none outside test environment', async () => {
    process.env.NODE_ENV = 'production';

    const response = createResponseMock();

    authServiceMock.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    await controller.login(
      {
        email: 'user@test.com',
        password: 'password',
      } as LoginRequestDto,
      response as any,
    );

    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      'access-token',
      'access-token',
      expect.objectContaining({
        secure: true,
        sameSite: 'none',
      }),
    );

    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      'refresh-token',
      'refresh-token',
      expect.objectContaining({
        secure: true,
        sameSite: 'none',
      }),
    );
  });

  it('should propagate login service errors', async () => {
    const response = createResponseMock();
    const error = new Error('login failed');

    authServiceMock.login.mockRejectedValue(error);

    await expect(
      controller.login({} as LoginRequestDto, response as any),
    ).rejects.toBe(error);

    expect(response.cookie).not.toHaveBeenCalled();
  });
});
