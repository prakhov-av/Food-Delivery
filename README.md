# Food Delivery

v1.0.12

A food delivery service. Customers order from restaurants, managers confirm and cook, couriers deliver, admins keep an eye on everything. NestJS backend, React frontend, a RAG-based assistant that also knows about your live orders, and an audit log that records who did what.

## Project structure

```text
Food-Delivery/
├── src/                    # Backend (NestJS + TypeORM)
│   ├── ai/                 # AI: chat, embeddings, RAG
│   ├── audit/              # Audit log: entity, service, interceptor, admin API
│   ├── auth/               # Authentication, JWT, guards, roles
│   ├── chat/               # RAG chat and live order data
│   ├── confirmation-codes/ # Email confirmation
│   ├── email/              # Email service
│   ├── embeddings/         # Qdrant integration
│   ├── ingestion/          # TXT, PDF, DOCX processing
│   ├── exceptions/         # Global error handling
│   ├── logging/            # Winston logging, secret masking
│   ├── restaurants/        # Restaurants API
│   ├── menus/              # Menus API
│   ├── menu-items/         # Menu items API
│   ├── orders/             # Orders API, status rules, limits (validation/)
│   ├── order-items/        # Order items API
│   ├── users/              # Users
│   ├── vector-storage/     # Qdrant storage
│   ├── prompts/            # AI prompts
│   └── main.ts             # Entry point
├── frontend/               # React SPA
│   ├── src/
│   │   ├── views/          # UI by role: restaurants, menus, dishes, orders, users, audit, auth
│   │   ├── ChatWidget.tsx  # Floating assistant
│   │   ├── api.ts          # HTTP client: cookies, automatic token refresh
│   │   ├── config.ts       # UI constants and order limits
│   │   ├── types.ts        # DTOs, role permissions, status transitions
│   │   ├── ui.tsx          # Shared components and labels
│   │   ├── App.tsx         # Main component
│   │   └── styles.css
│   └── vite.config.ts      # Dev-server proxy
├── test/                   # Integration / API tests
├── docs/                   # Documentation
└── database-demo/          # Demo data for local DB
```

## Tech stack

### Backend

- NestJS 11
- TypeORM 1.1
- PostgreSQL 15+
- Qdrant over HTTP
- JWT + httpOnly cookies
- Rate limiting (`@nestjs/throttler`)
- Swagger
- Winston
- Nodemailer + `@nestjs-modules/mailer`
- Mammoth for DOCX
- `pdf-parse` for PDF
- `class-validator` + `class-transformer`

### Frontend

- Vite 6
- React 18
- TypeScript
- Native `fetch` client with cookie auth and automatic token refresh
- Vite dev-server proxy

### Development

- Jest
- ESLint + Prettier
- ts-node for seed scripts

## What's included

### Authentication and roles

- Registration with email confirmation: the email contains a link with a one-time code
- JWT in httpOnly cookies (access token 15 minutes, refresh token 12 hours)
- Refresh token endpoint
- `GET /auth/me`: the frontend takes the current user and role from the server, nothing is stored in `localStorage`
- 4 roles: `ADMIN`, `MANAGER`, `CUSTOMER`, `COURIER`
- Role-based access control on the backend. The frontend only hides what the backend would reject anyway

| Capability | Customer | Courier | Manager | Admin |
| --- | :---: | :---: | :---: | :---: |
| Browse restaurants, menus, dishes | yes | yes | yes | yes |
| Create, edit, deactivate restaurants, menus, dishes | no | no | yes | yes |
| Create an order, edit its items | own, until accepted | no | active orders | active orders |
| Accept an order and move it to cooking and ready | no | no | yes | yes |
| Assign a courier manually | no | no | yes | yes |
| Pick up, deliver, complete | no | own orders | no | yes |
| Cancel an order | own, until pickup | own, "refuse" | until pickup | any time |
| Manage users, change roles | no | no | no | yes |
| List couriers (for assignment) | no | no | yes | yes |
| Read the audit log | no | no | no | yes |
| Upload documents to the knowledge base | no | no | no | yes |
| Ask the assistant | yes | yes | yes | yes |

### Core API

Currently there are 46 API endpoints covering:

- Auth (login, refresh, logout, current user)
- Users
- Restaurants
- Menus (with `?restaurantId=` filter)
- Menu items (with `?menuId=` filter)
- Orders
- Order items
- Chat
- Ingestion
- Audit log

Swagger documentation is available at `/swagger`.

### Orders

The order flow is built around a manager confirming the order before anything else happens:

```text
NEW ──► ACCEPTED ──► COOKING ──► READY ──► DELIVERING ──► COMPLETED
 │          │            │          │            │
 └──────────┴────────────┴──────────┴──► CANCELLED_STAFF   (manager, admin)
 └──────────┴────────────┘                CANCELLED_CUSTOMER (customer, until pickup)
                                  └──────► CANCELLED_COURIER  (courier, from READY or DELIVERING)
```

| Status | Meaning | Who moves it forward |
| --- | --- | --- |
| `NEW` | The customer's order, waiting for confirmation | Manager or admin accepts |
| `ACCEPTED` | Confirmed by the manager | Manager or admin |
| `COOKING` | Being prepared | Manager or admin |
| `READY` | Ready, a courier is assigned here | Courier |
| `DELIVERING` | With the courier | Courier |
| `COMPLETED` | Delivered | |
| `CANCELLED_CUSTOMER` | Cancelled by the customer | |
| `CANCELLED_STAFF` | Cancelled by a manager or an admin | |
| `CANCELLED_COURIER` | Courier refused the order | |

An admin can force any status. The rules live in `src/orders/validation/order-status-change.ts` and are mirrored in `frontend/src/types.ts`.

**Couriers.** When an order reaches `READY`, the system assigns a free courier automatically: an active courier who has no order in `READY` or `DELIVERING`. If nobody is free, the order stays unassigned and a manager or admin picks a courier by hand (`PATCH /orders/:id`). Manual assignment works until the order is closed.

**Cart behaviour.**

- A customer has one open order per restaurant. Adding another dish from the same restaurant goes into it
- Dishes must belong to the restaurant of the order
- An empty order cannot be accepted
- The order total is recalculated on the server whenever an item is added, changed, removed or restored
- Closed orders (completed or cancelled) cannot be modified

**Limits** (defined in `src/orders/validation/order-limits.ts`, defaults at the time of writing):

- 20 units of one dish
- 20 different items per order
- 500 order total
- 5 active orders per customer

### Audit log

Every important action is written to the append-only `audit_logs` table: who (user id and role), what, on which object, the result (`SUCCESS`, `DENIED`, `FAILED`), IP, user agent and sanitized details. Passwords and tokens never reach the log.

Recorded events include logins (successful and failed), registration and confirmation, user management, catalog changes, orders (creation, every status change with `from` and `to`, courier assignment, automatic or manual), order item changes and assistant queries (metadata only, never the text).

- `GET /audit-logs` is admin-only, paginated (`page`, `pageSize` up to 100) and filterable by `actorId`, `action`, `entityType`, `entityId`, `from` and `to`
- The admin UI has a **Journal** tab with filters and expandable details
- A failure to write an audit record never breaks the request itself, it is logged and the request goes on

### Security

- Rate limiting: 120 requests per minute per IP overall, 10 per minute on login, registration, order creation and chat. When exceeded, the API answers `429`
- Request validation rejects unknown fields (`whitelist` and `forbidNonWhitelisted`)
- Request logs mask passwords and tokens. Chat prompts are logged by size only. Set `CHAT_DEBUG_PROMPTS=true` locally to see full prompts
- Login failures return one generic error, so the API does not reveal whether an email is registered
- Only admins create, edit, deactivate and re-role users. Admins cannot deactivate themselves or change their own role. An account deactivated by an admin cannot be revived through self-registration
- Managers can list couriers (needed for assignment) but nothing else about users
- Customers and couriers only ever see their own orders
- Knowledge base uploads are admin-only

### RAG

- TXT, PDF and DOCX ingestion
- Content moderation before indexing
- Document versioning
- Embeddings stored in Qdrant

### Chat

The assistant is available to every signed-in user as a floating button in the lower right corner.

It can work with:

- Knowledge base data from Qdrant
- Current order data from PostgreSQL, always scoped to the signed-in user: customers see their orders, couriers see their assigned orders, staff see all

How it works:

- `POST /chat` with `{ "message": "..." }` returns the answer as plain text. `DELETE /chat` clears the caller's history
- The question is classified first. Order questions use live data, everything else uses the knowledge base. If the classifier returns something unusable, the assistant falls back to a general answer instead of failing
- The conversation history (last 10 messages per user) lives in memory and is cleared on sign-out
- The widget offers quick questions per role, so you can tap instead of typing
- Order questions work without Qdrant. Knowledge base questions need it

### Frontend

The frontend UI is role-based and currently includes:

- Restaurants, then menus, then dishes. Clicking a restaurant opens only its menus, clicking a menu opens only its dishes, with back buttons
- Restaurant, menu and dish management for managers and admins. Customers and couriers never see management controls
- "Add to order" for customers, with quantity limits
- Orders: items, quantities, totals, courier, per-role actions (accept, cooking, ready, pick up, deliver, cancel, refuse), courier picker for staff, collapsible history of closed orders
- Users tab (admin only)
- Journal tab with the audit log (admin only)
- Floating assistant with quick questions
- Registration and login. The confirmation link from the email opens `/?confirm=<code>` and the page confirms the registration by itself

The user role comes from `GET /auth/me`. The session is restored on page load and an expired access token is refreshed transparently.

## Recent changes

| Date | Developer | Change |
| --- | --- | --- |
| 05.10.2026 | offANTI | Order flow: manager confirmation, staff cancellation, manual and automatic courier assignment, new README |
| 04.10.2026 | offANTI | Audit log: backend and admin Journal tab |
| 03.10.2026 | offANTI | Security: rate limiting, secret masking in logs, order limits, user management rules |
| 02.10.2026 | offANTI | Floating assistant, orders UI with per-role actions |
| 01.10.2026 | offANTI | Role from `/auth/me`, restaurant to menu to dishes navigation, menu and menu item filters |
| 30.09.2026 | prakhov-av | Merged: extended integration tests with real authentication |
| 29.09.2026 | prakhov-av | Extended integration tests |
| 29.09.2026 | offANTI | Merged: REST API security testing |
| 29.09.2026 | offANTI | Merged: RBAC and authenticated integration tests |
| 24.09.2026 | prakhov-av | REST API security review completed |
| 24.09.2026 | offANTI | Merged: allow auth cookies in production |
| 24.09.2026 | offANTI | Merged: updated frontend CORS origin |
| 24.09.2026 | offANTI | Merged: normalized API request URLs |

## Running locally

### Backend

Install dependencies:

```bash
npm ci
```

Create your `.env` file from the provided example:

```powershell
Copy-Item .env.example .env
```

The example environment variables are already available in `.env.example`. The ones you will touch most often:

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | PostgreSQL connection |
| `DB_SSL` | `true` for a managed database that requires TLS |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing secrets |
| `QDRANT_URL` | Qdrant address, for example `http://localhost:6333` |
| `SERVER_HOST`, `SERVER_PORT` | Used to build the link in the confirmation email |
| `EMAIL_DRY_RUN` | `true` logs the confirmation link instead of sending an email |
| `CHAT_DEBUG_PROMPTS` | `true` logs full assistant prompts (local debugging only) |
| `PORT` | Backend port, `3000` by default |

PostgreSQL has to be running before the backend starts (a Docker container is the easiest way). The AI provider and mail settings are listed in `.env.example`.

Start the backend:

```bash
npm run start:dev
```

Backend will be available at:

```text
http://localhost:3000
```

To populate the database with demo data:

```bash
npm run seed
```

Demo accounts come from the seed data. Never reuse them outside local development.

#### Qdrant (only for knowledge base answers)

```bash
docker run -d --name qdrant -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant
```

Set `QDRANT_URL=http://localhost:6333`, restart the backend and upload your documents through `POST /ingestion/upload` (admin only). The Qdrant dashboard is at `http://localhost:6333/dashboard`. To try a different Qdrant without editing `.env`, override the variable for one run:

```powershell
$env:QDRANT_URL="http://localhost:6333"; npm run start:dev
```

#### Email confirmation without a mail server

Set `EMAIL_DRY_RUN=true`. After registration, take the code from the end of the confirmation link in the backend log and open `http://localhost:5173/?confirm=<code>`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at:

```text
http://localhost:5173
```

In development the browser talks to Vite, and Vite proxies API calls to the backend (`http://localhost:3000` by default). Useful variables:

| Variable | Purpose |
| --- | --- |
| `PROXY_TARGET` | Backend address for the dev proxy, for example a remote server. Set it for one run only |
| `VITE_API_URL` | Leave empty in development. In production, the public API URL |

The proxied paths are listed in `frontend/vite.config.ts`. **When you add a new top-level backend route, add it there too**, otherwise Vite answers `404`.

## Commands

```bash
npm run start:dev         # Start with hot reload
npm run build             # Build the project
npm run start:prod        # Start in production mode
npm run lint              # Run ESLint
npm run format            # Run Prettier
npm run seed              # Fill the database with demo data

npm test                  # Unit tests
npm run test:integration  # Integration tests
npm run test:cov          # Test coverage
npm run test:api          # API tests
```

Frontend (from `frontend/`):

```bash
npm run dev               # Dev server with API proxy
npm run build             # Type check and production build
```

## Testing

Latest full run:

- **529 / 529** unit tests
- **109 / 109** integration tests
- **3 / 3** API tests
- Coverage: **84.80%** statements, **75.64%** branches, **88.18%** functions, **86.04%** lines

What is covered: authentication and authorization (service, controller, guards, JWT, cookies), the CRUD services, controllers and DTO validation, the order business rules (access by role, status transitions, courier assignment, limits, item changes and totals), error handling, the audit log, the RAG pipeline (ingestion, chunking, embeddings, Qdrant storage, chat) and the live order data used by the assistant.

Services that write to the audit log receive a mock `AuditService` (`{ record: jest.fn() }`) in their specs, so unit tests never touch the database. When you change a constructor or a repository method, update the matching mock, that is almost always the reason a spec breaks.

## Known limitations

- `NEW` is both the cart and the request waiting for the manager, so a manager can accept an order while the customer is still adding dishes
- Couriers are assigned when the order becomes `READY`, and the free courier with the lowest id wins. If nobody is free, a manager assigns one by hand
- Refresh tokens are kept in memory, so a backend restart signs everybody out
- Lists of orders, order items and users are loaded and filtered in application code and are not paginated yet
- The database schema is synchronized by TypeORM (`synchronize: true`). Migrations are planned before any production deployment
- Access denials (`403`), rate limit hits (`429`) and sign-outs are not in the audit log yet
- Prices are displayed in ₽ regardless of the data
- The deployed server has no Qdrant yet, so knowledge base answers work locally only. Order questions work everywhere

## Roadmap

- Playwright end-to-end tests: role matrix in the UI, the full order flow, negative API checks
- Pagination and SQL-level filtering for large lists
- Persistent refresh tokens and per-account login lockout
- Migrations and a CI pipeline
- Deployment hardening (swap, log rotation, connection pool, audit retention)

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `429 Too Many Requests` after several logins | Rate limit, wait a minute |
| The page is blank and Vite prints `http proxy error` | The backend is not running or has not finished restarting |
| A new endpoint returns `404` from the frontend | The path is missing in `frontend/vite.config.ts` |
| Chat answers fail with `ECONNREFUSED ... :6333` | Qdrant is not running or `QDRANT_URL` is wrong. Start the container (on Windows, start Docker Desktop first) |
| Confirmation email never arrives locally | Use `EMAIL_DRY_RUN=true` and copy the link from the backend log |
| Login works but the session is lost | Auth cookies are `Secure`. Use Chrome on `localhost`, or HTTPS elsewhere |