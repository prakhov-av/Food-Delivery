import type { Request } from 'express';
import { User } from '../../users/user.entity';
import { ChatIdentity } from './chat-identity';

export interface ChatIdentityRequest extends Request {
  chatIdentity: ChatIdentity;
  user?: User;
}
