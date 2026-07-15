import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
} from 'typeorm';

import { Menu } from '../menus/menu.entity';
import { Order } from '../orders/order.entity';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @OneToOne(() => Menu, (menu) => menu.restaurant)
  menu: Menu;

  @OneToMany(() => Order, (order) => order.restaurant)
  orders: Order[];

  @Column({ name: 'active', nullable: false, default: true })
  active: boolean;
}
