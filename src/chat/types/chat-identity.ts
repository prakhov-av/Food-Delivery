import { Role } from '../../users/enums/role.enum';

/** Идентичность владельца диалога. */
export type ChatIdentity =
  | { kind: 'user'; userId: number; role: Role }
  | { kind: 'guest'; guestSessionId: string; role: Role.CUSTOMER };

export type ChatOwner =
  | { userId: number; guestSessionId?: never }
  | { userId?: never; guestSessionId: string };

export const getChatOwnerKey = (identity: ChatIdentity): string =>
  identity.kind === 'user'
    ? `user:${identity.userId}`
    : `guest:${identity.guestSessionId}`;
