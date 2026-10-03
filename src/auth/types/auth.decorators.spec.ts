import 'reflect-metadata';
import { IS_PUBLIC_KEY, Public, ROLES_KEY, Roles } from './auth.decorators';
import { Role } from '../../users/enums/role.enum';

describe('Auth decorators', () => {
  it('should define public metadata', () => {
    class TestController {}
    Public()(TestController);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestController)).toBe(true);
  });

  it('should define roles metadata', () => {
    class TestController {}
    Roles(Role.ADMIN, Role.MANAGER)(TestController);

    expect(Reflect.getMetadata(ROLES_KEY, TestController)).toEqual([
      Role.ADMIN,
      Role.MANAGER,
    ]);
  });
});
