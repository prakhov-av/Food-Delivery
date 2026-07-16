import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { Restaurant } from '../restaurants/restaurant.entity';
import { OrderItem } from '../order-items/order-item.entity';
import { Status } from './enums/status.enum';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ManyToOne(() => User, (user) => user.customerOrders, { nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @ManyToOne(() => User, (user) => user.courierOrders, { nullable: true })
  @JoinColumn({ name: 'courier_id' })
  courier: User;

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
}
