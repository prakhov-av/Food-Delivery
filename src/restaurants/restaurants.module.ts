import { Module } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restaurant } from './restaurant.entity';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsRepository } from './restaurants.repository';
import { RestaurantsMapper } from './dto/restaurants.mapper';

@Module({
  controllers: [RestaurantsController],
  imports: [TypeOrmModule.forFeature([Restaurant])],
  providers: [RestaurantsService, RestaurantsRepository, RestaurantsMapper],
  exports: [RestaurantsService, RestaurantsMapper],
})
export class RestaurantsModule {}
