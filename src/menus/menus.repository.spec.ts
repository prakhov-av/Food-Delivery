import { MenusRepository } from './menus.repository';
import { Menu } from './menu.entity';

describe('MenusRepository', (): void => {
  let repository: MenusRepository;

  const typeOrmRepository = {
    save: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach((): void => {
    jest.clearAllMocks();

    repository = new MenusRepository(typeOrmRepository as never);
  });

  describe('save', (): void => {
    it('should save and return menu', async (): Promise<void> => {
      const menu: Menu = {
        id: 1,
        name: 'Menu 1',
        active: true,
      } as Menu;

      typeOrmRepository.save.mockResolvedValue(menu);

      const result: Menu = await repository.save(menu);

      expect(typeOrmRepository.save).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.save).toHaveBeenCalledWith(menu);
      expect(result).toBe(menu);
    });

    it('should propagate save error', async (): Promise<void> => {
      const menu = {
        id: 1,
        name: 'Menu 1',
      } as Menu;

      typeOrmRepository.save.mockRejectedValue(
        new Error('Database save error'),
      );

      await expect(repository.save(menu)).rejects.toThrow(
        'Database save error',
      );

      expect(typeOrmRepository.save).toHaveBeenCalledWith(menu);
    });
  });

  describe('findAllActive', (): void => {
    it('should return active menus', async (): Promise<void> => {
      const menus: Menu[] = [
        {
          id: 1,
          name: 'Menu 1',
          active: true,
        } as Menu,
        {
          id: 2,
          name: 'Menu 2',
          active: true,
        } as Menu,
      ];

      typeOrmRepository.findBy.mockResolvedValue(menus);

      const result: Menu[] = await repository.findAllActive();

      expect(typeOrmRepository.findBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findBy).toHaveBeenCalledWith({
        active: true,
      });
      expect(result).toBe(menus);
    });

    it('should return empty array when there are no active menus', async (): Promise<void> => {
      typeOrmRepository.findBy.mockResolvedValue([]);

      const result: Menu[] = await repository.findAllActive();

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
    it('should return menu by id', async (): Promise<void> => {
      const menu: Menu = {
        id: 10,
        name: 'Menu 10',
        active: true,
      } as Menu;

      typeOrmRepository.findOneBy.mockResolvedValue(menu);

      const result: Menu | null = await repository.findById(10);

      expect(typeOrmRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
        id: 10,
      });
      expect(result).toBe(menu);
    });

    it('should return null when menu does not exist', async (): Promise<void> => {
      typeOrmRepository.findOneBy.mockResolvedValue(null);

      const result: Menu | null = await repository.findById(999);

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
    it('should delete menu by id', async (): Promise<void> => {
      typeOrmRepository.delete.mockResolvedValue({
        affected: 1,
      });

      await repository.deleteById(15);

      expect(typeOrmRepository.delete).toHaveBeenCalledTimes(1);
      expect(typeOrmRepository.delete).toHaveBeenCalledWith(15);
    });

    it('should complete when menu does not exist', async (): Promise<void> => {
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
