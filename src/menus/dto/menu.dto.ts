import { ApiProperty } from '@nestjs/swagger';

/**
   * Описывает структуру данных «MenuDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class MenuDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}
