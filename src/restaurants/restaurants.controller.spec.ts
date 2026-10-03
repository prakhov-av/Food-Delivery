import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';

describe('RestaurantsController', () => {
  let controller: RestaurantsController;
  const service = {
    create: jest.fn(), getAllActiveRestaurants: jest.fn(), getActiveRestaurantById: jest.fn(),
    update: jest.fn(), deleteById: jest.fn(), restoreById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RestaurantsController(service as unknown as RestaurantsService);
  });

  it('should create a restaurant', async () => {
    const dto = { name: 'Restaurant' } as any;
    const result = { id: 1 } as any;
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should get all active restaurants', async () => {
    const result = [{ id: 1 }] as any;
    service.getAllActiveRestaurants.mockResolvedValue(result);
    await expect(controller.getAll()).resolves.toBe(result);
    expect(service.getAllActiveRestaurants).toHaveBeenCalledWith();
  });

  it('should get restaurant by id', async () => {
    const result = { id: 5 } as any;
    service.getActiveRestaurantById.mockResolvedValue(result);
    await expect(controller.getById(5)).resolves.toBe(result);
    expect(service.getActiveRestaurantById).toHaveBeenCalledWith(5);
  });

  it('should update a restaurant', async () => {
    const dto = { newName: 'New Name' } as any;
    await controller.update(5, dto);
    expect(service.update).toHaveBeenCalledWith(5, dto);
  });

  it('should delete a restaurant', async () => {
    await controller.deleteById(5);
    expect(service.deleteById).toHaveBeenCalledWith(5);
  });

  it('should restore a restaurant', async () => {
    await controller.restoreById(5);
    expect(service.restoreById).toHaveBeenCalledWith(5);
  });
});
