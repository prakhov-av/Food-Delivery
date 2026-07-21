import { Injectable, Logger } from '@nestjs/common';
import { RestaurantsRepository } from './restaurants.repository';
import { RestaurantsMapper } from './dto/restaurants.mapper';
import { Restaurant } from './restaurant.entity';
import { RestaurantDto } from './dto/restaurant.dto';
import { RestaurantSaveDto } from './dto/restaurant.save-dto';
import { RestaurantUpdateDto } from './dto/restaurant.update-dto';
import { RestaurantsValidator } from './validation/restaurants.validator';
import { EntitySaveException } from '../exceptions/types/entity-save.exception';
import { EntityNotFoundException } from '../exceptions/types/entity-not-found.exception';

@Injectable()
export class RestaurantsService {
  private readonly logger: Logger = new Logger(RestaurantsService.name);

  constructor(
    private readonly repository: RestaurantsRepository,
    private readonly mapper: RestaurantsMapper,
    private readonly validator: RestaurantsValidator,
  ) {}

  async create(saveDto: RestaurantSaveDto): Promise<RestaurantDto> {
    if (await this.repository.isPhoneExists(saveDto.phone)) {
      throw new EntitySaveException(Restaurant.name, 'phone');
    }

    this.validator.validateSaveDto(saveDto);
    const entity: Restaurant = this.mapper.mapDtoToEntity(saveDto);
    entity.active = true;
    await this.repository.save(entity);

    this.logger.log(
      `Restaurant created: id ${entity.id}, phone number ${entity.phone}`,
    );

    return this.mapper.mapEntityToDto(entity);
  }

  async getAllActiveRestaurants(): Promise<RestaurantDto[]> {
    const restaurants: Restaurant[] = await this.repository.findAllActive();

    if (restaurants.length === 0) {
      throw new EntityNotFoundException(Restaurant.name);
    }

    return this.mapper.mapEntityListToDtoList(restaurants);
  }

  async getActiveRestaurantById(id: number): Promise<RestaurantDto> {
    const restaurant: Restaurant = await this.getActiveEntityById(id);
    return this.mapper.mapEntityToDto(restaurant);
  }

  async getActiveEntityById(id: number): Promise<Restaurant> {
    const restaurant: Restaurant | null = await this.repository.findById(id);

    if (!restaurant || !restaurant.active) {
      throw new EntityNotFoundException(Restaurant.name, id);
    }

    return restaurant;
  }

  async update(id: number, updateDto: RestaurantUpdateDto): Promise<void> {
    this.validator.validateUpdateDto(updateDto);
    const foundRestaurant: Restaurant = await this.getActiveEntityById(id);

    if (foundRestaurant) {
      foundRestaurant.name = updateDto.newName;
      await this.repository.save(foundRestaurant);

      this.logger.log(
        `Restaurant updated: id ${id}, new name ${foundRestaurant.name}`,
      );
    } else {
      throw new EntityNotFoundException(Restaurant.name, id);
    }
  }

  async deleteById(id: number): Promise<void> {
    const restaurant: Restaurant = await this.getActiveEntityById(id);
    restaurant.active = false;
    await this.repository.save(restaurant);

    this.logger.log(`Restaurant marked as inactive: id ${id}`);
  }

  async restoreById(id: number): Promise<void> {
    const restaurant: Restaurant | null = await this.repository.findById(id);

    if (!restaurant) {
      throw new EntityNotFoundException(Restaurant.name, id);
    }

    if (!restaurant.active) {
      restaurant.active = true;
      await this.repository.save(restaurant);

      this.logger.log(`Restaurant marked as active: id ${id}`);
    }
  }
}
