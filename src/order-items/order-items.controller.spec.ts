import { OrderItemsController } from './order-items.controller';
import { OrderItemsService } from './order-items.service';

describe('OrderItemsController', () => {
  let controller: OrderItemsController;
  const service = {
    create: jest.fn(), getAllActiveOrderItems: jest.fn(), getActiveOrderItemById: jest.fn(),
    update: jest.fn(), deleteById: jest.fn(), restoreById: jest.fn(),
  };
  const user = { id: 10, role: 'CUSTOMER' } as any;
  const request = { user } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OrderItemsController(service as unknown as OrderItemsService);
  });

  it('should create an order item for the current user', async () => {
    const dto = { orderId: 1, menuItemId: 2, quantity: 3 } as any;
    const result = { id: 5 } as any;
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto, request)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('should get all active order items for the current user', async () => {
    const result = [{ id: 5 }] as any;
    service.getAllActiveOrderItems.mockResolvedValue(result);
    await expect(controller.getAll(request)).resolves.toBe(result);
    expect(service.getAllActiveOrderItems).toHaveBeenCalledWith(user);
  });

  it('should get an order item by id for the current user', async () => {
    const result = { id: 5 } as any;
    service.getActiveOrderItemById.mockResolvedValue(result);
    await expect(controller.getById(5, request)).resolves.toBe(result);
    expect(service.getActiveOrderItemById).toHaveBeenCalledWith(5, user);
  });

  it('should update an order item for the current user', async () => {
    const dto = { newQuantity: 4 } as any;
    await controller.update(5, dto, request);
    expect(service.update).toHaveBeenCalledWith(5, dto, user);
  });

  it('should delete an order item for the current user', async () => {
    await controller.deleteById(5, request);
    expect(service.deleteById).toHaveBeenCalledWith(5, user);
  });

  it('should restore an order item for the current user', async () => {
    await controller.restoreById(5, request);
    expect(service.restoreById).toHaveBeenCalledWith(5, user);
  });
});
