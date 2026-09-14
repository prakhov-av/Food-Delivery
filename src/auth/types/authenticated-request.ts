import { User } from '../../users/user.entity';
import type { Request } from 'express';
// Очень важно прописать этот импорт вручную!
// Без этого будет использоваться Request глобальный (из DOM),
// а это не тот тип, который нам нужен.
// Нам нужен тип Request из фреймворка Express.

export interface AuthenticatedRequest extends Request {
  user: User;
}
