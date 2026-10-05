import { UsersMapper } from './users.mapper';
import { User } from '../user.entity';
import { UserDto } from './user.dto';
import { UserSaveDto } from './user.save-dto';
import { Role } from '../enums/role.enum';

describe('UsersMapper', (): void => {
  let mapper: UsersMapper;

  beforeEach((): void => {
    mapper = new UsersMapper();
  });

  describe('mapEntityToDto', (): void => {
    it('should map entity to dto', (): void => {
      const entity: User = new User();
      entity.id = 1;
      entity.name = 'John Doe';
      entity.role = Role.CUSTOMER;

      const result: UserDto = mapper.mapEntityToDto(entity);

      expect(result).toBeInstanceOf(UserDto);
      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          name: 'John Doe',
          role: Role.CUSTOMER,
        }),
      );
    });

    it('should return empty dto when entity is not provided', (): void => {
      const result: UserDto = mapper.mapEntityToDto(
        undefined as unknown as User,
      );

      expect(result).toBeInstanceOf(UserDto);
      expect(result).toEqual(new UserDto());
    });
  });

  describe('mapDtoToEntity', (): void => {
    it('should map save dto to entity', (): void => {
      const saveDto: UserSaveDto = new UserSaveDto();
      saveDto.email = 'john@example.com';
      saveDto.password = 'password123';
      saveDto.name = 'John Doe';

      const result: User = mapper.mapDtoToEntity(saveDto);

      expect(result).toBeInstanceOf(User);
      expect(result.email).toBe('john@example.com');
      expect(result.password).toBe('password123');
      expect(result.name).toBe('John Doe');
    });
  });

  describe('mapEntityListToDtoList', (): void => {
    it('should map entity list to dto list', (): void => {
      const firstEntity: User = new User();
      firstEntity.id = 1;
      firstEntity.name = 'John';
      firstEntity.role = Role.CUSTOMER;

      const secondEntity: User = new User();
      secondEntity.id = 2;
      secondEntity.name = 'Courier';
      secondEntity.role = Role.COURIER;

      const result: UserDto[] = mapper.mapEntityListToDtoList([
        firstEntity,
        secondEntity,
      ]);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        expect.objectContaining({
          id: 1,
          name: 'John',
          role: Role.CUSTOMER,
        }),
        expect.objectContaining({
          id: 2,
          name: 'Courier',
          role: Role.COURIER,
        }),
      ]);
    });

    it('should return empty list for empty entity list', (): void => {
      const result: UserDto[] = mapper.mapEntityListToDtoList([]);

      expect(result).toEqual([]);
    });
  });
});
