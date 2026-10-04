export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  userId?: number;
  role?: string;
}
