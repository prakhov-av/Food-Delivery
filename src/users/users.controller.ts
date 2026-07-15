import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { User } from './user.entity';
import { Role } from './enums/role.enum';

@Controller('users')
export class UsersController {
  @Post()
  create(@Body() user: User): User {
    console.log('Saved user:', user);
    return user;
  }

  @Get()
  getAll(): User[] {
    const user1: User = new User();
    user1.name = 'Vasya';
    const user2: User = new User();
    user2.name = 'Petya';
    return [user1, user2];
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number): User {
    console.log('ID:', id);
    const user: User = new User();
    user.name = 'Vasya';
    return user;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(@Param('id', ParseIntPipe) id: number, @Body() user: User): void {
    console.log('ID:', id);
    console.log('New name:', user.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteById(@Param('id', ParseIntPipe) id: number): void {
    console.log('Id:', id);
  }

  @Patch(':id/set-role/:role')
  @HttpCode(HttpStatus.NO_CONTENT)
  setRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('role', new ParseEnumPipe(Role)) role: Role,
  ): void {
    console.log('Id:', id);
    console.log('Role:', role);
  }
}
