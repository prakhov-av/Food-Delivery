import type { Request } from 'express';
import { GuestSession } from './guest-session.entity';

export interface GuestSessionRequest extends Request {
  guestSession: GuestSession;
}
