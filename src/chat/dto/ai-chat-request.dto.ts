import { IsNotEmpty, IsString } from 'class-validator';

/**
   * Описывает структуру данных «AiChatRequestDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class AiChatRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}