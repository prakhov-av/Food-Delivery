import { User } from '../../users/user.entity';
import type { Request } from 'express'; // Важно прописать вручную!

export interface AuthenticatedRequest extends Request {
  user: User;
}
