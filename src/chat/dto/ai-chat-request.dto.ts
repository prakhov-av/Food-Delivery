import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ALL_LANGS, Lang } from '../locales/lang';

/**
 * Описывает структуру данных «AiChatRequestDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
 */
export class AiChatRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  /**
   * Язык интерфейса, выбранный пользователем.
   *
   * Если язык не указан, backend определяет его сам: детектором для длинных
   * сообщений, языком предыдущего сообщения сессии — для коротких.
   */
  @IsOptional()
  @IsString()
  @IsIn(ALL_LANGS as string[])
  lang?: Lang;
}
