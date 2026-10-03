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
import { Roles } from '../auth/types/auth.decorators';
import { Role } from '../users/enums/role.enum';
import { Audit } from '../audit/audit.decorator';
import { AuditAction } from '../audit/audit.enums';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly service: RestaurantsService) {}

  @Audit({
    action: AuditAction.CATALOG_CREATED,
    entityType: 'Restaurant',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
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

  @Audit({
    action: AuditAction.CATALOG_DELETED,
    entityType: 'Restaurant',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: RestaurantUpdateDto,
  ): Promise<void> {
    await this.service.update(id, updateDto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.deleteById(id);
  }

  @Audit({
    action: AuditAction.CATALOG_RESTORED,
    entityType: 'Restaurant',
  })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreById(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.restoreById(id);
  }
}
