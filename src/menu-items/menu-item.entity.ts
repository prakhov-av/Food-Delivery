import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { Menu } from '../menus/menu.entity';
import { OrderItem } from '../order-items/order-item.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ManyToOne(() => Menu, (menu) => menu.items)
  @JoinColumn({ name: 'menu_id' })
  menu: Menu;

  @OneToMany(() => OrderItem, (item) => item.menuItem)
  orderItems: OrderItem[];

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({
    name: 'item_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  price: number;

  @Column({ default: true })
  active: boolean;
}
