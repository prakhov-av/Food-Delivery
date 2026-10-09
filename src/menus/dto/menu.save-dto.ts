import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches, Min } from 'class-validator';

/**
   * Описывает структуру данных «MenuSaveDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class MenuSaveDto {
  @ApiProperty()
  @Length(2, 50)
  @Matches(/^[A-Za-z\-' ]+$/, {
    message:
      'Name should contain only capital and small letters, spaces, dashes and apostrophes',
  })
  name: string;

  @ApiProperty()
  @Min(1)
  restaurantId: number;
}
