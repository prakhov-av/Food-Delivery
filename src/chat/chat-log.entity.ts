import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatLogKind } from './enums/chat-log-kind.enum';

@Entity('chat_logs')
@Check(
  'CHK_chat_logs_exactly_one_owner',
  '(("user_id" IS NOT NULL AND "guest_session_id" IS NULL) OR ("user_id" IS NULL AND "guest_session_id" IS NOT NULL))',
)
@Index(['userId', 'createdAt'])
@Index(['guestSessionId', 'createdAt'])
export class ChatLog {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'guest_session_id', type: 'uuid', nullable: true })
  guestSessionId: string | null;

  @Column({ name: 'user_role', type: 'varchar', length: 20 })
  userRole: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text', nullable: true })
  answer: string | null;

  @Column({ type: 'varchar', length: 20 })
  kind: ChatLogKind;

  @Column({ name: 'document_type', type: 'varchar', length: 20, nullable: true })
  documentType: string | null;

  @Column({ name: 'chunks_found', type: 'int', nullable: true })
  chunksFound: number | null;
}
