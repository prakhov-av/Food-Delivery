import { IsNotEmpty, IsString } from 'class-validator';

export class AiChatRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}