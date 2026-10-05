import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role } from './enums/role.enum';

describe('UsersController', () => {
  let controller: UsersController;
  const service = {
    create: jest.fn(), getAllActiveUsers: jest.fn(), getActiveUserById: jest.fn(),
    update: jest.fn(), deleteById: jest.fn(), restoreById: jest.fn(), setRole: jest.fn(),
    register: jest.fn(), confirmRegistration: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UsersController(service as unknown as UsersService);
  });

  it('should create a user', async () => {
    const dto = { email: 'a@test.com' } as any;
    const result = { id: 1 } as any;
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should get all active users', async () => {
    const result = [{ id: 1 }] as any;
    service.getAllActiveUsers.mockResolvedValue(result);
    await expect(controller.getAll()).resolves.toBe(result);
    expect(service.getAllActiveUsers).toHaveBeenCalledWith();
  });

  it('should get user by id', async () => {
    const result = { id: 7 } as any;
    service.getActiveUserById.mockResolvedValue(result);
    await expect(controller.getById(7)).resolves.toBe(result);
    expect(service.getActiveUserById).toHaveBeenCalledWith(7);
  });

  it('should update a user', async () => {
    const dto = { newName: 'John' } as any;
    await controller.update(7, dto);
    expect(service.update).toHaveBeenCalledWith(7, dto);
  });

  it('should delete a user', async () => {
    await controller.deleteById(7);
    expect(service.deleteById).toHaveBeenCalledWith(7);
  });

  it('should restore a user', async () => {
    await controller.restoreById(7);
    expect(service.restoreById).toHaveBeenCalledWith(7);
  });

  it('should set user role', async () => {
    await controller.setRole(7, Role.COURIER);
    expect(service.setRole).toHaveBeenCalledWith(7, Role.COURIER);
  });

  it('should register a user and return confirmation message', async () => {
    const dto = { email: 'a@test.com' } as any;
    await expect(controller.register(dto)).resolves.toBe('Registration complete. Check your email.');
    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it('should confirm registration and return confirmation message', async () => {
    await expect(controller.confirmRegistration('ABC123')).resolves.toBe('Registration confirmed');
    expect(service.confirmRegistration).toHaveBeenCalledWith('ABC123');
  });
});
