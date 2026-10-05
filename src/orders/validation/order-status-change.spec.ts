import { BadRequestException } from '@nestjs/common';

import { checkOrderStatusChange } from './order-status-change';
import { Status } from '../enums/status.enum';
import { Role } from '../../users/enums/role.enum';

describe('checkOrderStatusChange', (): void => {
  describe('ADMIN', (): void => {
    it('should allow any status transition', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.NEW, Status.COMPLETED, Role.ADMIN),
      ).not.toThrow();
    });

    it('should allow cancellation from any status', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.DELIVERING,
          Status.CANCELLED_STAFF,
          Role.ADMIN,
        ),
      ).not.toThrow();
    });
  });

  describe('CUSTOMER', (): void => {
    it('should allow NEW -> CANCELLED_CUSTOMER', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.NEW,
          Status.CANCELLED_CUSTOMER,
          Role.CUSTOMER,
        ),
      ).not.toThrow();
    });

    it('should allow ACCEPTED -> CANCELLED_CUSTOMER', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.ACCEPTED,
          Status.CANCELLED_CUSTOMER,
          Role.CUSTOMER,
        ),
      ).not.toThrow();
    });

    it('should allow COOKING -> CANCELLED_CUSTOMER', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.COOKING,
          Status.CANCELLED_CUSTOMER,
          Role.CUSTOMER,
        ),
      ).not.toThrow();
    });

    it('should reject NEW -> ACCEPTED', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.NEW, Status.ACCEPTED, Role.CUSTOMER),
      ).toThrow(BadRequestException);
    });

    it('should reject ACCEPTED -> COOKING', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.ACCEPTED, Status.COOKING, Role.CUSTOMER),
      ).toThrow(BadRequestException);
    });
  });

  describe('MANAGER', (): void => {
    it('should allow NEW -> ACCEPTED', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.NEW, Status.ACCEPTED, Role.MANAGER),
      ).not.toThrow();
    });

    it('should allow NEW -> CANCELLED_STAFF', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.NEW,
          Status.CANCELLED_STAFF,
          Role.MANAGER,
        ),
      ).not.toThrow();
    });

    it('should allow ACCEPTED -> COOKING', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.ACCEPTED, Status.COOKING, Role.MANAGER),
      ).not.toThrow();
    });

    it('should allow ACCEPTED -> CANCELLED_STAFF', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.ACCEPTED,
          Status.CANCELLED_STAFF,
          Role.MANAGER,
        ),
      ).not.toThrow();
    });

    it('should allow COOKING -> READY', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.COOKING, Status.READY, Role.MANAGER),
      ).not.toThrow();
    });

    it('should allow COOKING -> CANCELLED_STAFF', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.COOKING,
          Status.CANCELLED_STAFF,
          Role.MANAGER,
        ),
      ).not.toThrow();
    });

    it('should allow READY -> CANCELLED_STAFF', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.READY,
          Status.CANCELLED_STAFF,
          Role.MANAGER,
        ),
      ).not.toThrow();
    });

    it('should reject NEW -> COOKING', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.NEW, Status.COOKING, Role.MANAGER),
      ).toThrow(BadRequestException);
    });

    it('should reject ACCEPTED -> READY', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.ACCEPTED, Status.READY, Role.MANAGER),
      ).toThrow(BadRequestException);
    });

    it('should reject READY -> COMPLETED', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.READY, Status.COMPLETED, Role.MANAGER),
      ).toThrow(BadRequestException);
    });
  });

  describe('COURIER', (): void => {
    it('should allow READY -> DELIVERING', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.READY, Status.DELIVERING, Role.COURIER),
      ).not.toThrow();
    });

    it('should allow READY -> CANCELLED_COURIER', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.READY,
          Status.CANCELLED_COURIER,
          Role.COURIER,
        ),
      ).not.toThrow();
    });

    it('should allow DELIVERING -> COMPLETED', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.DELIVERING,
          Status.COMPLETED,
          Role.COURIER,
        ),
      ).not.toThrow();
    });

    it('should allow DELIVERING -> CANCELLED_COURIER', (): void => {
      expect(() =>
        checkOrderStatusChange(
          Status.DELIVERING,
          Status.CANCELLED_COURIER,
          Role.COURIER,
        ),
      ).not.toThrow();
    });

    it('should reject READY -> COMPLETED', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.READY, Status.COMPLETED, Role.COURIER),
      ).toThrow(BadRequestException);
    });

    it('should reject DELIVERING -> READY', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.DELIVERING, Status.READY, Role.COURIER),
      ).toThrow(BadRequestException);
    });
  });

  describe('error message', (): void => {
    it('should contain role and statuses in the error message', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.NEW, Status.COOKING, Role.CUSTOMER),
      ).toThrow(
        `Role ${Role.CUSTOMER} cannot change order status from ${Status.NEW} to ${Status.COOKING}`,
      );
    });
  });
});
