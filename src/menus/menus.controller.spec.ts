import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';

describe('MenusController', () => {
  let controller: MenusController;

  const service = {
    create: jest.fn(),
    getAllActiveMenus: jest.fn(),
    getActiveMenuById: jest.fn(),
    update: jest.fn(),
    deleteById: jest.fn(),
    restoreById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MenusController(service as unknown as MenusService);
  });

  it('should create a menu', async () => {
    const dto = { name: 'Main Menu', restaurantId: 1 } as any;
    const result = { id: 1 } as any;

    service.create.mockResolvedValue(result);

    await expect(controller.create(dto)).resolves.toBe(result);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should get all active menus', async () => {
    const result = [{ id: 1 }] as any;

    service.getAllActiveMenus.mockResolvedValue(result);

    await expect(controller.getAll()).resolves.toBe(result);

    expect(service.getAllActiveMenus).toHaveBeenCalledWith(undefined);
  });

  it('should get menu by id', async () => {
    const result = { id: 2 } as any;

    service.getActiveMenuById.mockResolvedValue(result);

    await expect(controller.getById(2)).resolves.toBe(result);

    expect(service.getActiveMenuById).toHaveBeenCalledWith(2);
  });

  it('should update a menu', async () => {
    const dto = { newName: 'Updated' } as any;

    await controller.update(2, dto);

    expect(service.update).toHaveBeenCalledWith(2, dto);
  });

  it('should delete a menu', async () => {
    await controller.deleteById(2);

    expect(service.deleteById).toHaveBeenCalledWith(2);
  });

  it('should restore a menu', async () => {
    await controller.restoreById(2);

    expect(service.restoreById).toHaveBeenCalledWith(2);
  });
});
