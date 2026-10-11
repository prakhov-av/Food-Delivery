import { ApiProperty } from '@nestjs/swagger';
import { ChatLogKind } from '../enums/chat-log-kind.enum';

export class ChatHistoryItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  question: string;

  @ApiProperty({ type: String, nullable: true })
  answer: string | null;

  @ApiProperty({ enum: ChatLogKind })
  kind: ChatLogKind;
}
