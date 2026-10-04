import { Restaurant } from '../restaurant.entity';
import { RestaurantDto } from './restaurant.dto';
import { RestaurantSaveDto } from './restaurant.save-dto';
import { RestaurantsMapper } from './restaurants.mapper';
describe('RestaurantsMapper', (): void => {
  let mapper: RestaurantsMapper;
  beforeEach((): void => {
    mapper = new RestaurantsMapper();
  });
  describe('mapEntityToDto', (): void => {
    it('should map restaurant entity to DTO', (): void => {
      const entity: Restaurant = {
        id: 1,
        name: 'Restaurant 1',
        address: 'Address 1',
        phone: '+491234567890',
        email: 'restaurant1@test.com',
      } as Restaurant;
      const result: RestaurantDto = mapper.mapEntityToDto(entity);
      expect(result).toBeInstanceOf(RestaurantDto);
      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'Restaurant 1',
          address: 'Address 1',
          phone: '+491234567890',
          email: 'restaurant1@test.com',
        }),
      );
    });
    it('should return empty DTO when entity is null', (): void => {
      const result: RestaurantDto = mapper.mapEntityToDto(
        null as unknown as Restaurant,
      );
      expect(result).toBeInstanceOf(RestaurantDto);
      expect(result).toEqual(new RestaurantDto());
    });
    it('should return empty DTO when entity is undefined', (): void => {
      const result: RestaurantDto = mapper.mapEntityToDto(
        undefined as unknown as Restaurant,
      );
      expect(result).toBeInstanceOf(RestaurantDto);
      expect(result).toEqual(new RestaurantDto());
    });
  });
  describe('mapDtoToEntity', (): void => {
    it('should map restaurant save DTO to entity', (): void => {
      const saveDto: RestaurantSaveDto = {
        name: 'Restaurant 1',
        address: 'Address 1',
        phone: '+491234567890',
        email: 'restaurant1@test.com',
      };
      const result: Restaurant = mapper.mapDtoToEntity(saveDto);
      expect(result).toBeInstanceOf(Restaurant);
      expect(result).toEqual(
        expect.objectContaining({
          name: 'Restaurant 1',
          address: 'Address 1',
          phone: '+491234567890',
          email: 'restaurant1@test.com',
        }),
      );
      expect(result.id).toBeUndefined();
      expect(result.active).toBeUndefined();
    });
  });
  describe('mapEntityListToDtoList', (): void => {
    it('should map all restaurant entities to DTOs', (): void => {
      const entities: Restaurant[] = [
        {
          id: 1,
          name: 'Restaurant 1',
          address: 'Address 1',
          phone: '+491234567890',
          email: 'restaurant1@test.com',
        } as Restaurant,
        {
          id: 2,
          name: 'Restaurant 2',
          address: 'Address 2',
          phone: '+491234567891',
          email: 'restaurant2@test.com',
        } as Restaurant,
      ];
      const result: RestaurantDto[] = mapper.mapEntityListToDtoList(entities);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'Restaurant 1',
          address: 'Address 1',
          phone: '+491234567890',
          email: 'restaurant1@test.com',
        }),
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: 2,
          name: 'Restaurant 2',
          address: 'Address 2',
          phone: '+491234567891',
          email: 'restaurant2@test.com',
        }),
      );
    });
    it('should return empty array for empty entity list', (): void => {
      const result: RestaurantDto[] = mapper.mapEntityListToDtoList([]);
      expect(result).toEqual([]);
    });
    it('should preserve the order of entities', (): void => {
      const entities: Restaurant[] = [
        {
          id: 10,
          name: 'Restaurant 10',
          address: 'Address 10',
          phone: '+491000000010',
          email: 'restaurant10@test.com',
        } as Restaurant,
        {
          id: 20,
          name: 'Restaurant 20',
          address: 'Address 20',
          phone: '+491000000020',
          email: 'restaurant20@test.com',
        } as Restaurant,
      ];
      const result: RestaurantDto[] = mapper.mapEntityListToDtoList(entities);
      expect(result.map((dto: RestaurantDto) => dto.id)).toEqual([10, 20]);
    });
  });
});
