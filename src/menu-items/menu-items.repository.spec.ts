import { MenuItemsRepository } from './menu-items.repository';
import { MenuItem } from './menu-item.entity';

describe('MenuItemsRepository', (): void => {
  let repository: MenuItemsRepository;

  const typeOrmRepository = {
    save: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach((): void => {
    jest.clearAllMocks();

    repository = new MenuItemsRepository(typeOrmRepository as never);
  });

  describe('save', (): void => {
    it('should save and return menu item', async (): Promise<void> => {
      const menuItem: MenuItem = {
        id: 1,
        name: 'Pizza',
        description: 'Pizza description',
        price: 12.5,
        active: true,
      } as MenuItem;

      typeOrmRepository.save.mockResolvedValue(menuItem);

      const result: MenuItem = await repository.save(menuItem);

      expect(typeOrmRepository.save).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(menuItem);
      expect(result).toBe(menuItem);
    });

    it('should propagate save error', async (): Promise<void> => {
      const menuItem = {
        id: 1,
        name: 'Pizza',
      } as MenuItem;

      typeOrmRepository.save.mockRejectedValue(
        new Error('Database save error'),
      );

      await expect(repository.save(menuItem)).rejects.toThrow(
        'Database save error',
      );

      expect(typeOrmRepository.save).toHaveBeenCalledWith(menuItem);
    });
  });

  describe('findAllActive', (): void => {
    it('should return active menu items', async (): Promise<void> => {
      const menuItems: MenuItem[] = [
        {
          id: 1,
          name: 'Pizza',
          active: true,
        } as MenuItem,
        {
          id: 2,
          name: 'Burger',
          active: true,
        } as MenuItem,
      ];

      typeOrmRepository.findBy.mockResolvedValue(menuItems);

      const result: MenuItem[] = await repository.findAllActive();

      expect(typeOrmRepository.findBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findBy).toHaveBeenCalledWith({
        active: true,
      });
      expect(result).toBe(menuItems);
    });

    it('should return empty array when there are no active menu items', async (): Promise<void> => {
      typeOrmRepository.findBy.mockResolvedValue([]);

      const result: MenuItem[] = await repository.findAllActive();

      expect(result).toEqual([]);

      expect(typeOrmRepository.findBy).toHaveBeenCalledWith({
        active: true,
      });
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.findBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.findAllActive()).rejects.toThrow(
        'Database query error',
      );
    });
  });

  describe('findById', (): void => {
    it('should return menu item by id', async (): Promise<void> => {
      const menuItem: MenuItem = {
        id: 10,
        name: 'Pizza',
        active: true,
      } as MenuItem;

      typeOrmRepository.findOneBy.mockResolvedValue(menuItem);

      const result: MenuItem | null = await repository.findById(10);

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 10,
      });
      expect(result).toBe(menuItem);
    });

    it('should return null when menu item does not exist', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockResolvedValue(null);

      const result: MenuItem | null = await repository.findById(999);

      expect(result).toBeNull();

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 999,
      });
    });

    it('should propagate repository error', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockRejectedValue(
        new Error('Database query error'),
      );

      await expect(repository.findById(1)).rejects.toThrow(
        'Database query error',
      );
    });
  });

  describe('deleteById', (): void => {
    it('should delete menu item by id', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 1,
      });

      await repository.deleteById(15);

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith(15);
    });

    it('should complete when menu item does not exist', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 0,
      });

      await expect(repository.deleteById(999)).resolves.toBeUndefined();

      expect(typeOrmRepository.delete).toHaveBeenCalledWith(999);
    });

    it('should propagate delete error', async (): Promise<void> => {
      typeOrmRepository.delete.mockRejectedValue(
        new Error('Database delete error'),
      );

      await expect(repository.deleteById(1)).rejects.toThrow(
        'Database delete error',
      );
    });
  });
});
