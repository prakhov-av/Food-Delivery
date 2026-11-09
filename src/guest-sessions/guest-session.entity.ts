import {
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

import { Order } from '../orders/order.entity';

/**
 * Represents a temporary guest session without a registered user account.
 * Only the SHA-256 hash of the cookie secret is stored in the database.
 */
@Entity('guest_sessions')
export class GuestSession {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: false,
  })
  tokenHash: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'last_activity_at',
    type: 'timestamp',
    nullable: false,
  })
  lastActivityAt: Date;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
    nullable: true,
  })
  expiresAt: Date | null;

  @OneToMany(() => Order, (order) => order.guestSession)
  orders: Order[];
}
