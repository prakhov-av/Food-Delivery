import { User } from '../../users/user.entity';
import type { Request } from 'express';
// Очень важно прописать этот импорт вручную!
// Без этого будет использоваться Request глобальный (из DOM),
// а это не тот тип, который нам нужен.
// Нам нужен тип Request из фреймворка Express.

/**
   * Определяет типизированную структуру «AuthenticatedRequest», используемую при обмене данными между компонентами.
   */
export interface AuthenticatedRequest extends Request {
  user: User;
}
