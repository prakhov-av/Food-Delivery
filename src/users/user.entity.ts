import { Role } from './enums/role.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'name', nullable: false, unique: false })
  name: string;

  @Column({ name: 'password', nullable: false, unique: false })
  password: string;

  @Column({ name: 'email', nullable: false, unique: true })
  email: string;

  @Column({ name: 'phone', nullable: false, unique: true })
  phone: string;

  @Column({ name: 'role', nullable: false, type: 'enum', enum: Role })
  role: Role;

  @CreateDateColumn({ name: 'created_at', nullable: false, unique: false })
  createdAt: Date;

  @Column({ name: 'deleted_at', nullable: true, unique: false })
  deletedAt: Date;

  @Column({ name: 'active', nullable: false, unique: false })
  active: boolean;

  @OneToMany(() => Order, (order) => order.customer)
  customerOrders: Order[];

  @OneToMany(() => Order, (order) => order.courier)
  courierOrders: Order[];
}
