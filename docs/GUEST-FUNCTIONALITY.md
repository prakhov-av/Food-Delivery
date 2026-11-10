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
| `GET` | `/guest-sessions` | Public endpoint; returns `{ expiresAt }` of the current guest session, `401` when the cookie is missing, invalid or expired |
| `POST` | `/guest-sessions/revoke` | Public endpoint; revokes the cookie's session and clears the cookie; returns `204` |

Both endpoints are marked public because they establish or revoke the guest identity rather than requiring a registered-user JWT.

`GET /guest-sessions` exists so that the frontend can restore the guest mode after a page reload without creating a new session on every refresh.

### Cookie attributes

| Environment | `Secure` | `SameSite` |
| --- | --- | --- |
| Production | yes | `None` — the frontend and the API are on different domains, so the cookie has to be cross-site |
| Development and tests | no | `Lax` — over plain `http://localhost` a `Secure` cookie would be rejected by the browser |

In production the frontend and the API are served from different domains, so the `Origin` of every state-changing request must be listed in `CORS_ORIGINS`. Otherwise the CSRF middleware rejects the request with `403 Invalid request origin`.

## 4. Guest orders and ownership

`GuestOrdersService` scopes every repository lookup by `guestSessionId`:

- `getGuestOrders()` returns active orders belonging to the specified session.
- `getCurrentGuestOrders()` returns only those active orders whose statuses are not in `CLOSED_STATUSES`.
- `getGuestOrderWithItemsById()` loads an active order only when both the order id and guest-session id match, then returns its active items.

When no matching order is found, the service throws `EntityNotFoundException`. An order id alone is therefore insufficient to read a guest order. The guest-session id is part of the ownership condition, preventing one guest from reading another guest's order by guessing or learning its numeric id.

The database relationship also records guest ownership on the order. The schema enforces that an order is owned either by a registered customer or by a guest session, rather than both. The exact constraint and foreign-key behaviour are defined by the guest-session migration.

## 4.1 Guest order REST API

`GuestOrdersController` exposes the guest checkout. All routes are public at the HTTP level and protected by `GuestSessionGuard`, which resolves the guest session from the cookie and puts it into `request.guestSession`. The client never sends a `guestSessionId` or a `userId`.

| Method | Endpoint | Body | Behaviour |
| --- | --- | --- | --- |
| `GET` | `/guest-orders` | — | Returns the orders of the current guest session with their active positions; an empty list when there are no orders |
| `POST` | `/guest-orders` | `{ restaurantId }` | Returns the active `NEW` draft of the guest in that restaurant, creating it when it does not exist |
| `POST` | `/guest-orders/:id/items` | `{ menuItemId, quantity }` | Adds a position to the guest order; an already present position is increased instead of duplicated |
| `PATCH` | `/guest-orders/:id/items/:itemId` | `{ newQuantity }` | Changes the quantity of a position |
| `DELETE` | `/guest-orders/:id/items/:itemId` | — | Deactivates a position |
| `PATCH` | `/guest-orders/:id/status` | `{ status }` | Moves the order forward in the guest status chain |

Order ownership is always part of the repository condition: `findActiveByIdForGuestSession(orderId, guestSessionId)` matches the order id and the owner at the same time. An order id alone never grants access.

Positions can only be changed while the order is in `NEW`, the same rule that applies to a registered customer. The order total is recalculated from the active positions after every change, and the limits `MAX_ITEMS_PER_ORDER`, `MAX_QUANTITY_PER_ITEM` and `MAX_ORDER_TOTAL` apply to guests as well.

### Guest status chain

The guest chooses the status of their own order. The chain is forward-only and contains no cancellation statuses, because the assistant has no up-to-date data about a cancellation:

```
NEW -> ACCEPTED -> COOKING -> READY -> DELIVERING -> COMPLETED
```

`checkGuestStatusChange` rejects any transition that is not one of the next steps in the chain, including every `CANCELLED_*` status and any move backwards. Leaving `NEW` requires at least one active position, and `READY` assigns a free courier automatically, exactly as it does for a registered order. The status chosen by the guest is the status the assistant reports, because `LiveDataService` reads the very same guest orders.

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

### Applying migrations

The application applies pending migrations on start: `TypeOrmModule.forRoot` in `src/app.module.ts` points at the compiled migrations in `dist/database/migrations` and sets `migrationsRun: true`. A container that starts with an outdated database therefore upgrades itself instead of failing requests with `QueryFailedError`.

For a manual run use `npm run migration:run` (and `npm run migration:show` to see what is pending). The migration command reads the same environment variables as the application.

The catalog endpoints `GET /restaurants`, `GET /restaurants/:id`, `GET /menus`, `GET /menus/:id`, `GET /menu-items` and `GET /menu-items/:id` are public: a guest has to be able to browse the menu before placing an order.

## 8. Environment configuration

| Variable | Default / rule | Purpose |
| --- | --- | --- |
| `GUEST_SESSION_TTL_DAYS` | `30`; positive integer required | Guest session lifetime in days |
| `GUEST_SESSION_RETENTION_DAYS` | `30`; positive integer required | How long an expired guest session and its orders are kept |
| `CHAT_HISTORY_RETENTION_DAYS` | `30` when unset, non-numeric or zero | Retention window for persisted chat logs |

`GUEST_SESSION_TTL_DAYS` is optional. The session service falls back to 30 days when the configured value is not a positive integer. `CHAT_HISTORY_RETENTION_DAYS` is read by `ChatLogService` at module load. The implementation falls back to 30 days when the value converts to `0` or `NaN`; a negative numeric value is not rejected by the current implementation.

### Removing stale guest sessions

`GuestSessionsService.deleteExpiredSessions()` removes guest sessions whose `expires_at` is older than `GUEST_SESSION_RETENTION_DAYS`. The cleanup runs when a new guest session is created, the same lazy approach that `ChatLogService` uses for chat history: no scheduler and no extra dependency are needed, and the cleanup only costs a query when guest sessions actually accumulate.

The orders of a removed guest are deleted by PostgreSQL itself: `orders.guest_session_id` references `guest_sessions` with `ON DELETE CASCADE`, and `order_items` references `orders` with `ON DELETE CASCADE`. No application code deletes orders.

A consequence of that schema rule is worth knowing: a guest order cannot outlive its session. The check constraint `CHK_orders_exactly_one_owner` requires every order to have either a customer or a guest session, so there is no way to keep the orders of an anonymous visitor once the session itself is gone.

## 9. Security considerations

- The raw guest token is a bearer secret and is sent only in an `HttpOnly` cookie; the database stores its SHA-256 hash.
- Guest cookies are scoped to `/` and use `Secure`/`SameSite` settings appropriate to the runtime environment.
- Session lookup checks expiration before granting access.
- Revocation expires the session and clears the browser cookie.
- Order ownership is enforced in repository lookups, not by trusting an order id supplied by the client.
- Chat history uses the same owner separation as live order data.
- An invalid JWT cookie must not cause a fallback to guest identity.
- The guest-session row is retained on revocation because orders may have a foreign-key reference to it.
- Expired guest sessions are removed after `GUEST_SESSION_RETENTION_DAYS`, and the orders of an anonymous visitor are removed with them by the cascade in the database.
- The guest endpoints are rate limited per IP: creating a session is allowed 5 times a minute, creating an order 10 times a minute, and changing positions or the status 30 times a minute. A guest session can hold at most `MAX_ACTIVE_GUEST_ORDERS` active orders.
- The rate limit is bound to the IP address, so it does not stop an attacker who rotates addresses. The remaining protection is the infrastructure level: a firewall or a bot-protection service in front of the API.
- The guest session lives in the browser cookie and is not tied to a person. On a shared device the next visitor inherits the session of the previous one and sees its orders. The «Выйти» button revokes the session and clears the cookie.

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
