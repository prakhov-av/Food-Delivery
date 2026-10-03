import { Order } from '../order.entity';
import { Status } from '../enums/status.enum';
import { User } from '../../users/user.entity';
import { Role } from '../../users/enums/role.enum';
import { Restaurant } from '../../restaurants/restaurant.entity';
import { OrderDto } from './order.dto';
import { OrderSaveDto } from './order.save-dto';
import { OrdersMapper } from './orders.mapper';
import { UsersMapper } from '../../users/dto/users.mapper';
import { RestaurantsMapper } from '../../restaurants/dto/restaurants.mapper';
describe('OrdersMapper', (): void => {
  let mapper: OrdersMapper;
  beforeEach((): void => {
    mapper = new OrdersMapper(new UsersMapper(), new RestaurantsMapper());
  });
  describe('mapEntityToDto', (): void => {
    it('should return an empty DTO when entity is empty', (): void => {
      const result: OrderDto = mapper.mapEntityToDto(
        undefined as unknown as Order,
      );
      expect(result).toBeInstanceOf(OrderDto);
      expect(result).toEqual(new OrderDto());
    });
    it('should map entity with courier to DTO', (): void => {
      const customer: User = {
        id: 1,
        name: 'Customer',
        role: Role.CUSTOMER,
      } as User;
      const courier: User = {
        id: 2,
        name: 'Courier',
        role: Role.COURIER,
      } as User;
      const restaurant: Restaurant = {
        id: 3,
        name: 'Restaurant',
      } as Restaurant;
      const createdAt: Date = new Date(2026, 9, 3);
      const entity: Order = {
        id: 10,
        customer,
        courier,
        restaurant,
        status: Status.NEW,
        totalPrice: 25.5,
        createdAt,
        items: [],
        active: true,
      } as Order;
      const result: OrderDto = mapper.mapEntityToDto(entity);
      expect(result.id).toBe(10);
      expect(result.customer.id).toBe(1);
      expect(result.customer.name).toBe('Customer');
      expect(result.customer.role).toBe(Role.CUSTOMER);
      expect(result.courier).not.toBeNull();
      expect(result.courier?.id).toBe(2);
      expect(result.courier?.name).toBe('Courier');
      expect(result.courier?.role).toBe(Role.COURIER);
      expect(result.restaurant.id).toBe(3);
      expect(result.restaurant.name).toBe('Restaurant');
      expect(result.status).toBe(Status.NEW);
      expect(result.totalPrice).toBe(25.5);
      expect(result.createdAt).toEqual(createdAt);
    });
    it('should map entity without courier to DTO with null courier', (): void => {
      const customer: User = {
        id: 1,
        name: 'Customer',
        role: Role.CUSTOMER,
      } as User;
      const restaurant: Restaurant = {
        id: 3,
        name: 'Restaurant',
      } as Restaurant;
      const entity: Order = {
        id: 10,
        customer,
        courier: null,
        restaurant,
        status: Status.NEW,
        totalPrice: 0,
        createdAt: new Date(2026, 9, 3),
        items: [],
        active: true,
      } as Order;
      const result: OrderDto = mapper.mapEntityToDto(entity);
      expect(result.id).toBe(10);
      expect(result.customer.id).toBe(1);
      expect(result.restaurant.id).toBe(3);
      expect(result.courier).toBeNull();
      expect(result.status).toBe(Status.NEW);
      expect(result.totalPrice).toBe(0);
    });
  });
  describe('mapDtoToEntity', (): void => {
    it('should create a new Order entity', (): void => {
      const saveDto: OrderSaveDto = {
        customerId: 1,
        restaurantId: 3,
      } as OrderSaveDto;
      const result: Order = mapper.mapDtoToEntity(saveDto);
      expect(result).toBeInstanceOf(Order);
    });
  });
  describe('mapEntityListToDtoList', (): void => {
    it('should map a list of entities to DTOs', (): void => {
      const customer: User = {
        id: 1,
        name: 'Customer',
        role: Role.CUSTOMER,
      } as User;
      const restaurant: Restaurant = {
        id: 3,
        name: 'Restaurant',
      } as Restaurant;
      const entities: Order[] = [
        {
          id: 10,
          customer,
          courier: null,
          restaurant,
          status: Status.NEW,
          totalPrice: 10,
          createdAt: new Date(2026, 9, 3),
          items: [],
          active: true,
        } as Order,
        {
          id: 11,
          customer,
          courier: { id: 2, name: 'Courier', role: Role.COURIER } as User,
          restaurant,
          status: Status.COMPLETED,
          totalPrice: 20,
          createdAt: new Date(2026, 9, 3),
          items: [],
          active: true,
        } as Order,
      ];
      const result: OrderDto[] = mapper.mapEntityListToDtoList(entities);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(OrderDto);
      expect(result[0].id).toBe(10);
      expect(result[0].courier).toBeNull();
      expect(result[1].id).toBe(11);
      expect(result[1].courier?.id).toBe(2);
      expect(result[1].status).toBe(Status.COMPLETED);
    });
  });
});
