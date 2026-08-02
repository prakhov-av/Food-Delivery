import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };

  let request: any;
  let context: ExecutionContext;

  beforeEach(async () => {
    jest.clearAllMocks();

    request = {};

    context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: reflectorMock,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow endpoint without roles', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when request has no user', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMIN']);

    request.user = undefined;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should allow user with required role', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMIN']);

    request.user = {
      role: 'ADMIN',
    };

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny user with wrong role', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMIN']);

    request.user = {
      role: 'CLIENT',
    };

    expect(guard.canActivate(context)).toBe(false);
  });
});
