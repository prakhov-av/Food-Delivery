/**
   * Описывает структуру данных «TokenResponseDto», используемую на границе API или между слоями приложения; ограничения полей определяются декораторами валидации, если они предусмотрены.
   */
export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  userId?: number;
  role?: string;
}
