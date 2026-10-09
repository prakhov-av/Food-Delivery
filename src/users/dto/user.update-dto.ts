import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches } from 'class-validator';

/**
   * Описывает структуру данных «UserUpdateDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class UserUpdateDto {
  @ApiProperty()
  @Length(2, 30)
  @Matches(/^[A-Za-z\-' ]+$/, {
    message:
      'Name should contain only capital and small letters, spaces, dashes and apostrophes',
  })
  newName: string;
}
