import { Injectable } from '@nestjs/common';
import { RestaurantsRepository } from './restaurants.repository';
import { RestaurantsMapper } from './dto/restaurants.mapper';
import { Restaurant } from './restaurant.entity';
import { RestaurantDto } from './dto/restaurant.dto';
import { RestaurantSaveDto } from './dto/restaurant.save-dto';
import { RestaurantUpdateDto } from './dto/restaurant.update-dto';

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly repository: RestaurantsRepository,
    private readonly mapper: RestaurantsMapper,
  ) {}

  async create(saveDto: RestaurantSaveDto): Promise<RestaurantDto> {
    const entity: Restaurant = this.mapper.mapDtoToEntity(saveDto);
    entity.active = true;
    await this.repository.save(entity);
    return this.mapper.mapEntityToDto(entity);
  }

  async getAllActiveRestaurants(): Promise<RestaurantDto[]> {
    const restaurants: Restaurant[] = await this.repository.findAllActive();
    return this.mapper.mapEntityListToDtoList(restaurants);
  }

  async getActiveRestaurantById(id: number): Promise<RestaurantDto> {
    const restaurant: Restaurant = await this.getActiveEntityById(id);
    return this.mapper.mapEntityToDto(restaurant);
  }

  async getActiveEntityById(id: number): Promise<Restaurant> {
    const restaurant: Restaurant | null = await this.repository.findById(id);

    if (!restaurant || !restaurant.active) {
      throw Error();
    }

    return restaurant;
  }

  async update(id: number, updateDto: RestaurantUpdateDto): Promise<void> {
    const foundRestaurant: Restaurant | null =
      await this.repository.findById(id);

    if (foundRestaurant) {
      foundRestaurant.name = updateDto.newName;
      await this.repository.save(foundRestaurant);
    }
  }

  async deleteById(id: number): Promise<void> {
    const restaurant: Restaurant = await this.getActiveEntityById(id);
    restaurant.active = false;
    await this.repository.save(restaurant);
  }

  async restoreById(id: number): Promise<void> {
    const restaurant: Restaurant | null = await this.repository.findById(id);

    if (restaurant && !restaurant.active) {
      restaurant.active = true;
      await this.repository.save(restaurant);
    }
  }
}
