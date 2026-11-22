import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ALL_LANGS, Lang } from '../locales/lang';

/**
 * Максимальная длина сообщения чата.
 *
 * Без ограничения один скрипт может отправлять сообщения без остановки:
 * счёт за LLM и эмбеддинги растёт, а ответ всё равно бесполезный.
 */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Описывает структуру данных «AiChatRequestDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
 */
export class AiChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
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
