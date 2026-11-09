# Guest sessions, guest orders and guest AI chat

## 1. Architecture overview

The guest functionality allows a visitor to use the assistant and to own orders without creating a registered user account. A guest is represented by a `GuestSession`, not by a row in the users table and not by a new application role. Guest requests use `Role.CUSTOMER` for role-dependent assistant behaviour.

The implementation is split across these areas:

- `src/guest-sessions/` — guest-session entity, lifecycle service, cookie controller and identity guard.
- `src/orders/guest-orders.service.ts` — reads orders belonging to a guest session.
- `src/chat/` — resolves the chat identity, scopes live order data and persists chat history by owner.
- `src/database/migrations/` — creates the guest-session table and adds guest ownership to orders and chat logs.

The authenticated-user flow remains separate. A chat identity is either a registered user (`userId`) or a guest (`guestSessionId`); the two ownership forms are not combined.

## 2. Guest session lifecycle

### Creation

`POST /guest-sessions` creates a guest session. The service:

1. Generates a cryptographically random 32-byte token and encodes it as hexadecimal.
2. Calculates a SHA-256 hash of the token.
3. Stores the hash, not the raw token, in `guest_sessions`.
4. Sets the expiration time using the configured session lifetime.
5. Returns the expiration time and places the raw token in the `guest-session` cookie. The token is not returned in the JSON response.

The cookie is `HttpOnly`, uses `Path=/`, and has a `Max-Age` matching the configured lifetime. In test mode the cookie uses `SameSite=Lax`; outside test mode it uses `SameSite=None` and `Secure`.

### Resolution and expiration

For a request carrying a guest cookie, the service hashes the supplied token and looks up the matching session. Missing, unknown or expired sessions are rejected. A successful resolution updates `lastActivityAt`.

The optional `GUEST_SESSION_TTL_DAYS` environment variable controls the lifetime in days. It must be a positive integer. If it is absent or invalid, the service uses the default of 30 days.

### Revocation

`POST /guest-sessions/revoke` revokes the session identified by the cookie and clears the cookie. Revocation sets the database `expiresAt` value to the current time; it does not delete the session row. Retaining the row is important because guest orders may reference it.

## 3. Guest session REST API

| Method | Endpoint | Behaviour |
| --- | --- | --- |
| `POST` | `/guest-sessions` | Public endpoint; creates a guest session, sets the `guest-session` cookie and returns `{ expiresAt }` |
| `POST` | `/guest-sessions/revoke` | Public endpoint; revokes the cookie's session and clears the cookie; returns `204` |

Both endpoints are marked public because they establish or revoke the guest identity rather than requiring a registered-user JWT.

There are currently no dedicated guest-order REST endpoints. Guest order reads are implemented by `GuestOrdersService` and are used by the assistant's live-data path. Do not assume routes such as `/guest-orders` exist.

## 4. Guest orders and ownership

`GuestOrdersService` scopes every repository lookup by `guestSessionId`:

- `getGuestOrders()` returns active orders belonging to the specified session.
- `getCurrentGuestOrders()` returns only those active orders whose statuses are not in `CLOSED_STATUSES`.
- `getGuestOrderWithItemsById()` loads an active order only when both the order id and guest-session id match, then returns its active items.

When no matching order is found, the service throws `EntityNotFoundException`. An order id alone is therefore insufficient to read a guest order. The guest-session id is part of the ownership condition, preventing one guest from reading another guest's order by guessing or learning its numeric id.

The database relationship also records guest ownership on the order. The schema enforces that an order is owned either by a registered customer or by a guest session, rather than both. The exact constraint and foreign-key behaviour are defined by the guest-session migration.

## 5. Guest AI chat

The chat controller is public at the route level and uses `ChatIdentityGuard` to establish the caller's identity. The guard resolves one of two identities:

- If an access-token cookie is present, it is validated and the registered user's identity is used.
- If there is no access-token cookie, the `guest-session` cookie is resolved and the request receives a guest identity with `Role.CUSTOMER`.

An invalid access token is an authentication failure; it is not treated as permission to fall back to a guest identity.

The chat endpoints are:

| Method | Endpoint | Behaviour |
| --- | --- | --- |
| `POST` | `/chat` | Generates an answer for the resolved identity; request body contains the message |
| `GET` | `/chat/history?limit=50` | Returns the resolved identity's chat history; default limit is 50 |
| `DELETE` | `/chat` | Clears the active chat context for the resolved identity; returns `204` |
| `DELETE` | `/chat/history` | Clears stored history for the resolved identity; returns `204` |

`LiveDataService` routes order-related questions to the appropriate service. For a guest identity it calls `GuestOrdersService`; for an authenticated identity it calls `OrdersService`. The assistant therefore uses the same ownership boundary as the order service. It can answer questions about the guest's current orders and details of a particular order only when that order belongs to the current guest session.

Empty carts (`NEW` orders with a total price of zero) are filtered out of the guest's list of visible orders in the assistant, matching the existing assistant behaviour for registered customers.

## 6. Authentication and authorization rules

- Guest access is represented by a session cookie, not by a registered user account.
- Guests use the existing `CUSTOMER` role; no `GUEST` role is introduced.
- The backend derives the identity from cookies. A client must not submit an arbitrary `userId` or `guestSessionId` to choose whose data to access.
- Registered-user chat requests continue to use the JWT identity.
- If an access-token cookie is present but invalid, the guard rejects the request rather than downgrading it to guest access.
- Guest order lookups always include the current `guestSessionId` in the repository condition.
- Guest chat history is queried and deleted by guest-session id, independently of registered-user history.

## 7. Database schema and migrations

### `guest_sessions`

The `GuestSession` entity maps to `guest_sessions` and contains:

| Column | Meaning |
| --- | --- |
| `id` | UUID primary key |
| `token_hash` | Unique 64-character SHA-256 token hash; raw cookie token is not stored |
| `created_at` | Session creation timestamp |
| `last_activity_at` | Last successful session resolution timestamp |
| `expires_at` | Session expiration timestamp; nullable at the entity level |

A guest session can be related to multiple orders.

### `chat_logs`

`ChatLog` supports exactly one owner per row: either `user_id` is set and `guest_session_id` is null, or `guest_session_id` is set and `user_id` is null. A database check constraint enforces this invariant. Separate indexes support owner-and-date queries.

Chat log rows contain the role, question, answer, log kind, optional document type and optional number of retrieved chunks. The service stores and retrieves records separately for registered users and guest sessions.

### Migrations

The guest functionality is introduced by these migrations:

- `1794235914032-AddGuestSessions.ts` — adds guest sessions and guest order ownership.
- `1794237000000-AddGuestChatLogs.ts` — adds guest ownership to chat logs and enforces the single-owner rule.

The initial schema migration is `1794227040000-InitialSchema.ts`.

The application uses `synchronize: false`; schema changes are managed by migrations. The `down()` implementation of the guest-session migration is destructive for guest-owned orders, so do not run that rollback without first assessing the data impact. The initial schema migration is intentionally irreversible.

## 8. Environment configuration

| Variable | Default / rule | Purpose |
| --- | --- | --- |
| `GUEST_SESSION_TTL_DAYS` | `30`; positive integer required | Guest session lifetime in days |
| `CHAT_HISTORY_RETENTION_DAYS` | `30` when unset, non-numeric or zero | Retention window for persisted chat logs |

`GUEST_SESSION_TTL_DAYS` is optional. The session service falls back to 30 days when the configured value is not a positive integer. `CHAT_HISTORY_RETENTION_DAYS` is read by `ChatLogService` at module load. The implementation falls back to 30 days when the value converts to `0` or `NaN`; a negative numeric value is not rejected by the current implementation.

## 9. Security considerations

- The raw guest token is a bearer secret and is sent only in an `HttpOnly` cookie; the database stores its SHA-256 hash.
- Guest cookies are scoped to `/` and use `Secure`/`SameSite` settings appropriate to the runtime environment.
- Session lookup checks expiration before granting access.
- Revocation expires the session and clears the browser cookie.
- Order ownership is enforced in repository lookups, not by trusting an order id supplied by the client.
- Chat history uses the same owner separation as live order data.
- An invalid JWT cookie must not cause a fallback to guest identity.
- The guest-session row is retained on revocation because orders may have a foreign-key reference to it.

## 10. Testing

The guest functionality should be covered at the relevant layers:

- Guest session creation, token hashing, expiry, resolution and revocation.
- Cookie attributes and cookie clearing on the guest-session controller.
- Rejection of missing, invalid and expired guest-session tokens.
- Identity resolution for JWT users and guests, including rejection of invalid JWT without guest fallback.
- Guest order queries scoped by `guestSessionId`, including attempts to read another session's order.
- Guest chat history retrieval, context-window loading, retention cleanup and deletion scoped by guest-session id.
- Assistant live-data handling for guest order lists and individual guest orders.

Run the project's unit, integration and API test commands described in the root README. The implementation state reported for this project has passed its test suites and production build; rerun the checks after documentation or code changes when preparing a new release.
