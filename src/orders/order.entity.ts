import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Check,
} from 'typeorm';

import { User } from '../users/user.entity';
import { Restaurant } from '../restaurants/restaurant.entity';
import { OrderItem } from '../order-items/order-item.entity';
import { GuestSession } from '../guest-sessions/guest-session.entity';
import { Status } from './enums/status.enum';

/**
 * Represents an order and its state throughout processing and delivery.
 * An order must belong to exactly one registered user or guest session.
 */
@Entity('orders')
@Check(
  'CHK_orders_exactly_one_owner',
  '("customer_id" IS NOT NULL AND "guest_session_id" IS NULL) OR ("customer_id" IS NULL AND "guest_session_id" IS NOT NULL)',
)
export class Order {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ManyToOne(() => User, (user) => user.customerOrders, {
    nullable: true,
  })
  @JoinColumn({ name: 'customer_id' })
  customer: User | null;

  @ManyToOne(() => User, (user) => user.courierOrders, {
    nullable: true,
  })
  @JoinColumn({ name: 'courier_id' })
  courier: User | null;

  @ManyToOne(() => GuestSession, (guestSession) => guestSession.orders, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'guest_session_id' })
  guestSession: GuestSession | null;

  @ManyToOne(() => Restaurant, { nullable: false })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @Column({ name: 'order_status', nullable: false, type: 'enum', enum: Status })
  status: Status;

  @Column({
    name: 'total_price',
    nullable: false,
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  totalPrice: number;

  @CreateDateColumn({ name: 'created_at', nullable: false, unique: false })
  createdAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @Column({ name: 'active', nullable: false, default: true })
  active: boolean;
}
