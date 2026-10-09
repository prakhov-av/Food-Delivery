import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches } from 'class-validator';

/**
   * Описывает структуру данных «MenuUpdateDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class MenuUpdateDto {
  @ApiProperty()
  @Length(2, 50)
  @Matches(/^[A-Za-z\-' ]+$/, {
    message:
      'Name should contain only capital and small letters, spaces, dashes and apostrophes',
  })
  newName: string;
}
