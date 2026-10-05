import { BadRequestException } from '@nestjs/common';
import { Role } from '../../users/enums/role.enum';
import { Status } from '../enums/status.enum';
import { checkOrderStatusChange } from './order-status-change';

describe('checkOrderStatusChange', (): void => {
  describe('admin', (): void => {
    it('should allow any status transition', (): void => {
      expect(() =>
        checkOrderStatusChange(Status.NEW, Status.COMPLETED, Role.ADMIN),
      ).not.toThrow();
    });
  });

  describe('customer', (): void => {
    it.each([
      [Status.NEW, Status.CREATED],
      [Status.NEW, Status.CANCELLED_CUSTOMER],
      [Status.CREATED, Status.CANCELLED_CUSTOMER],
      [Status.ACCEPTED, Status.CANCELLED_CUSTOMER],
      [Status.COOKING, Status.CANCELLED_CUSTOMER],
    ])('should allow %s -> %s', (currentStatus: Status, newStatus: Status) => {
      expect(() =>
        checkOrderStatusChange(currentStatus, newStatus, Role.CUSTOMER),
      ).not.toThrow();
    });
  });

  describe('manager', (): void => {
    it.each([
      [Status.CREATED, Status.ACCEPTED],
      [Status.ACCEPTED, Status.COOKING],
      [Status.COOKING, Status.READY],
    ])('should allow %s -> %s', (currentStatus: Status, newStatus: Status) => {
      expect(() =>
        checkOrderStatusChange(currentStatus, newStatus, Role.MANAGER),
      ).not.toThrow();
    });
  });

  describe('courier', (): void => {
    it.each([
      [Status.READY, Status.DELIVERING],
      [Status.READY, Status.CANCELLED_COURIER],
      [Status.DELIVERING, Status.COMPLETED],
      [Status.DELIVERING, Status.CANCELLED_COURIER],
    ])('should allow %s -> %s', (currentStatus: Status, newStatus: Status) => {
      expect(() =>
        checkOrderStatusChange(currentStatus, newStatus, Role.COURIER),
      ).not.toThrow();
    });
  });

  it('should reject a transition not defined for the role', (): void => {
    expect(() =>
      checkOrderStatusChange(Status.NEW, Status.ACCEPTED, Role.CUSTOMER),
    ).toThrow(
      new BadRequestException(
        'Role CUSTOMER cannot change order status from NEW to ACCEPTED',
      ),
    );
  });

  it('should reject a transition from a status with no allowed transitions', (): void => {
    expect(() =>
      checkOrderStatusChange(Status.COMPLETED, Status.READY, Role.COURIER),
    ).toThrow(
      new BadRequestException(
        'Role COURIER cannot change order status from COMPLETED to READY',
      ),
    );
  });

  it('should reject an unsupported manager transition', (): void => {
    expect(() =>
      checkOrderStatusChange(Status.NEW, Status.ACCEPTED, Role.MANAGER),
    ).toThrow(BadRequestException);
  });
});
