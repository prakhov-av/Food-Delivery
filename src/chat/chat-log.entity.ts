import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatLogKind } from './enums/chat-log-kind.enum';

@Entity('chat_logs')
@Index(['userId', 'createdAt'])
export class ChatLog {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'user_role', type: 'varchar', length: 20 })
  userRole: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text', nullable: true })
  answer: string | null;

  @Column({ type: 'varchar', length: 20 })
  kind: ChatLogKind;

  @Column({
    name: 'document_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  documentType: string | null;

  @Column({ name: 'chunks_found', type: 'int', nullable: true })
  chunksFound: number | null;
}
