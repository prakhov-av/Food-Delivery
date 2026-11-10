import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity';
import { Restaurant } from '../restaurants/restaurant.entity';
import { Menu } from '../menus/menu.entity';
import { MenuItem } from '../menu-items/menu-item.entity';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../order-items/order-item.entity';
import { ConfirmationCode } from '../confirmation-codes/confirmation-code.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { QuarantineDocument } from '../ingestion/quarantine-document.entity';
import { ChatLog } from '../chat/chat-log.entity';
import { GuestSession } from '../guest-sessions/guest-session.entity';

/**
 * Возвращает обязательную переменную окружения.
 *
 * @param name Имя переменной окружения.
 * @returns Значение переменной окружения.
 * @throws Error Если переменная отсутствует или пуста.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const port = Number(getRequiredEnv('DB_PORT'));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT must be a valid TCP port.');
}

/**
 * TypeORM DataSource для CLI миграций.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: getRequiredEnv('DB_HOST'),
  port,
  username: getRequiredEnv('DB_USERNAME'),
  password: getRequiredEnv('DB_PASSWORD'),
  database: getRequiredEnv('DB_DATABASE'),

  entities: [
    User,
    Restaurant,
    Menu,
    MenuItem,
    Order,
    OrderItem,
    ConfirmationCode,
    AuditLog,
    QuarantineDocument,
    ChatLog,
    GuestSession,
  ],

  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],

  migrationsTableName: 'migrations',

  synchronize: false,

  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
