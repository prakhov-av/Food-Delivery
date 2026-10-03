import { OrdersValidator } from './orders.validator';
import { Status } from '../enums/status.enum';
import { OrderSaveDto } from '../dto/order.save-dto';
import { OrderUpdateDto } from '../dto/order.update-dto';

describe('OrdersValidator', (): void => {
  let validator: OrdersValidator;

  beforeEach((): void => {
    validator = new OrdersValidator();
  });

  describe('validateSaveDto', (): void => {
    it('should accept a valid DTO', (): void => {
      const dto: OrderSaveDto = {
        customerId: 1,
        restaurantId: 2,
      };

      expect(() => validator.validateSaveDto(dto)).not.toThrow();
    });

    it('should reject a missing DTO', (): void => {
      expect(() => validator.validateSaveDto(undefined as unknown as OrderSaveDto)).toThrow();
    });

    it.each([undefined, 0, -1])(
      'should reject invalid customerId: %s',
      (customerId: number | undefined): void => {
        const dto = {
          customerId,
          restaurantId: 1,
        } as OrderSaveDto;

        expect(() => validator.validateSaveDto(dto)).toThrow();
      },
    );

    it.each([undefined, 0, -1])(
      'should reject invalid restaurantId: %s',
      (restaurantId: number | undefined): void => {
        const dto = {
          customerId: 1,
          restaurantId,
        } as OrderSaveDto;

        expect(() => validator.validateSaveDto(dto)).toThrow();
      },
    );
  });

  describe('validateUpdateDto', (): void => {
    it('should accept a valid status without courier', (): void => {
      const dto: OrderUpdateDto = {
        status: Status.CREATED,
      };

      expect(() => validator.validateUpdateDto(dto)).not.toThrow();
    });

    it('should accept a valid status with a positive courierId', (): void => {
      const dto: OrderUpdateDto = {
        status: Status.ACCEPTED,
        courierId: 5,
      };

      expect(() => validator.validateUpdateDto(dto)).not.toThrow();
    });

    it('should reject a missing DTO', (): void => {
      expect(() => validator.validateUpdateDto(undefined as unknown as OrderUpdateDto)).toThrow();
    });

    it('should reject an invalid status', (): void => {
      const dto = {
        status: 'INVALID_STATUS',
      } as OrderUpdateDto;

      expect(() => validator.validateUpdateDto(dto)).toThrow();
    });

    it('should reject a negative courierId', (): void => {
      const dto = {
        status: Status.CREATED,
        courierId: -1,
      } as OrderUpdateDto;

      expect(() => validator.validateUpdateDto(dto)).toThrow();
    });

    it('should reject courierId equal to zero', (): void => {
      const dto = {
        status: Status.CREATED,
        courierId: 0,
      } as OrderUpdateDto;

      expect(() => validator.validateUpdateDto(dto)).toThrow();
    });
  });
});
