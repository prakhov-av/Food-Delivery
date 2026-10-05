import { OrdersController } from './orders.controller';
import { Status } from './enums/status.enum';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  const service = {
    create: jest.fn(),
    getAllOrders: jest.fn(),
    getOrderById: jest.fn(),
    update: jest.fn(),
    setStatus: jest.fn(),
  };
  const user = { id: 10, role: 'CUSTOMER' } as any;
  const request = { user } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OrdersController(service as unknown as OrdersService);
  });

  it('should create an order for the current user', async () => {
    const dto = { restaurantId: 2, customerId: 10 } as any;
    const result = { id: 1 } as any;
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto, request)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('should get all orders for the current user', async () => {
    const result = [{ id: 1 }] as any;
    service.getAllOrders.mockResolvedValue(result);
    await expect(controller.getAll(request)).resolves.toBe(result);
    expect(service.getAllOrders).toHaveBeenCalledWith(user);
  });

  it('should get an order by id for the current user', async () => {
    const result = { id: 1 } as any;
    service.getOrderById.mockResolvedValue(result);
    await expect(controller.getById(1, request)).resolves.toBe(result);
    expect(service.getOrderById).toHaveBeenCalledWith(1, user);
  });

  it('should update an order', async () => {
    const dto = { courierId: 2 };
    await controller.update(1, dto);
    expect(service.update).toHaveBeenCalledWith(1, dto);
  });

  it('should set order status for the current user', async () => {
    await controller.setStatus(1, Status.COOKING, request);
    expect(service.setStatus).toHaveBeenCalledWith(1, Status.COOKING, user);
  });
});
