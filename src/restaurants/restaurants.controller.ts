import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { RestaurantDto } from './dto/restaurant.dto';
import { RestaurantSaveDto } from './dto/restaurant.save-dto';
import { RestaurantUpdateDto } from './dto/restaurant.update-dto';
import { ApiOkResponse } from '@nestjs/swagger';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly service: RestaurantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({
    type: RestaurantDto,
  })
  async create(@Body() saveDto: RestaurantSaveDto): Promise<RestaurantDto> {
    return this.service.create(saveDto);
  }

  @Get()
  @ApiOkResponse({
    type: RestaurantDto,
    isArray: true,
  })
  async getAll(): Promise<RestaurantDto[]> {
    return this.service.getAllActiveRestaurants();
  }

  @Get(':id')
  @ApiOkResponse({
    type: RestaurantDto,
  })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<RestaurantDto> {
    return this.service.getActiveRestaurantById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: RestaurantUpdateDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.deleteById(id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.restoreById(id);
  }
}
