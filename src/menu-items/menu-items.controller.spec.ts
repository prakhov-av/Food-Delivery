import { MenuItemsController } from './menu-items.controller';
import { MenuItemsService } from './menu-items.service';

describe('MenuItemsController', () => {
  let controller: MenuItemsController;
  const service = {
    create: jest.fn(), getAllActiveMenuItems: jest.fn(), getActiveMenuItemById: jest.fn(),
    update: jest.fn(), deleteById: jest.fn(), restoreById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MenuItemsController(service as unknown as MenuItemsService);
  });

  it('should create a menu item', async () => {
    const dto = { name: 'Pizza', menuId: 1 } as any;
    const result = { id: 1 } as any;
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should get all active menu items', async () => {
    const result = [{ id: 1 }] as any;
    service.getAllActiveMenuItems.mockResolvedValue(result);
    await expect(controller.getAll()).resolves.toBe(result);
    expect(service.getAllActiveMenuItems).toHaveBeenCalledWith();
  });

  it('should get menu item by id', async () => {
    const result = { id: 3 } as any;
    service.getActiveMenuItemById.mockResolvedValue(result);
    await expect(controller.getById(3)).resolves.toBe(result);
    expect(service.getActiveMenuItemById).toHaveBeenCalledWith(3);
  });

  it('should update a menu item', async () => {
    const dto = { newName: 'Updated', newDescription: 'Desc', newPrice: 10 } as any;
    await controller.update(3, dto);
    expect(service.update).toHaveBeenCalledWith(3, dto);
  });

  it('should delete a menu item', async () => {
    await controller.deleteById(3);
    expect(service.deleteById).toHaveBeenCalledWith(3);
  });

  it('should restore a menu item', async () => {
    await controller.restoreById(3);
    expect(service.restoreById).toHaveBeenCalledWith(3);
  });
});
