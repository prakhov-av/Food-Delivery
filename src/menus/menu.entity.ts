import {
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Column,
} from 'typeorm';

import { Restaurant } from '../restaurants/restaurant.entity';
import { MenuItem } from '../menu-items/menu-item.entity';

@Entity('menus')
export class Menu {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column() // под расширение, например: Основное меню, Летнее меню, Детское меню
  name: string;

  @OneToOne(() => Restaurant, (restaurant) => restaurant.menu)
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @OneToMany(() => MenuItem, (item) => item.menu)
  items: MenuItem[];

  @Column({ name: 'active', nullable: false, default: true })
  active: boolean;
}
