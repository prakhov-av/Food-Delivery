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
      expect(() =>
        validator.validateSaveDto(undefined as unknown as OrderSaveDto),
      ).toThrow();
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
    it('should accept a valid positive courierId', (): void => {
      const dto: OrderUpdateDto = {
        courierId: 5,
      };

      expect(() => validator.validateUpdateDto(dto)).not.toThrow();
    });

    it('should accept an empty update DTO at validator level', (): void => {
      const dto: OrderUpdateDto = {};

      expect(() => validator.validateUpdateDto(dto)).not.toThrow();
    });

    it('should reject a missing DTO', (): void => {
      expect(() =>
        validator.validateUpdateDto(undefined as unknown as OrderUpdateDto),
      ).toThrow();
    });

    it.each([0, -1])(
      'should reject invalid courierId: %s',
      (courierId: number): void => {
        const dto: OrderUpdateDto = { courierId };

        expect(() => validator.validateUpdateDto(dto)).toThrow();
      },
    );
  });
});
