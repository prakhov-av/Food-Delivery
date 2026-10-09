# Food Delivery

v1.0.12

A food delivery service. Customers order from restaurants, managers confirm and cook, couriers deliver, admins keep an eye on everything. NestJS backend, React frontend, a RAG-based assistant that also knows about your live orders, and an audit log that records who did what.

The project is deployed on DigitalOcean (backend and frontend on App Platform, PostgreSQL as a managed database, Qdrant on a Droplet). See [Deployment](#deployment-digitalocean).

- Frontend: https://fds-frontend-app-v4kqn.ondigitalocean.app
- Backend API: https://fds-app-cke6h.ondigitalocean.app

This is an educational project. Demo accounts and demo data are for local development and presentations only.

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
│   ├── embeddings/         # Embeddings service
│   ├── ingestion/          # TXT, PDF, DOCX processing, safety check, quarantine
│   ├── exceptions/         # Global error handling
│   ├── logging/            # Winston logging, secret masking
│   ├── restaurants/        # Restaurants API
│   ├── menus/              # Menus API
│   ├── menu-items/         # Menu items API
│   ├── orders/             # Orders API, status rules, limits (validation/)
│   ├── order-items/        # Order items API
│   ├── security/           # CSRF Origin check middleware
│   ├── users/              # Users
│   ├── vector-storage/     # Qdrant client and storage
│   ├── prompts/            # AI prompts
│   └── main.ts             # Entry point
├── frontend/               # React SPA
│   ├── src/
│   │   ├── views/          # UI by role: restaurants, menus, dishes, orders, users, audit, upload, auth
│   │   ├── ChatWidget.tsx  # Floating assistant
│   │   ├── api.ts          # HTTP client: cookies, automatic token refresh, JSON and multipart
│   │   ├── config.ts       # UI constants and order limits
│   │   ├── types.ts        # DTOs, role permissions, status transitions
│   │   ├── ui.tsx          # Shared components and labels
│   │   ├── App.tsx         # Main component
│   │   └── styles.css
│   └── vite.config.ts      # Dev-server proxy
├── test/                   # Integration / API tests
├── docs/
│   └── knowledge-base/     # Starter documents for the assistant (+ demo/ for the safety check)
└── database-demo/          # Demo data for local DB
```

## Tech stack

### Backend

- NestJS 11
- TypeORM 1.1
- PostgreSQL 15+ (managed PostgreSQL 18 in production)
- Qdrant over HTTP (optional API key)
- JWT + httpOnly cookies
- Rate limiting (`@nestjs/throttler`)
- CSRF Origin check for state-changing requests
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

Recorded events include logins (successful and failed), registration and confirmation, user management, catalog changes, orders (creation, every status change with `from` and `to`, courier assignment, automatic or manual), order item changes, knowledge base uploads (`KNOWLEDGE_UPLOADED`, including failed and quarantined ones) and assistant queries (metadata only, never the text).

- `GET /audit-logs` is admin-only, paginated (`page`, `pageSize` up to 100) and filterable by `actorId`, `action`, `entityType`, `entityId`, `from` and `to`
- The admin UI has a **Journal** tab with filters and expandable details
- A failure to write an audit record never breaks the request itself, it is logged and the request goes on

### Security

- Rate limiting: 120 requests per minute per IP overall, 10 per minute on login, registration, order creation and chat. When exceeded, the API answers `429`
- CSRF protection: every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) must carry an `Origin` header that is listed in `CORS_ORIGINS`, otherwise the API answers `403`. This matters because the auth cookies are `SameSite=None`
- Request validation rejects unknown fields (`whitelist` and `forbidNonWhitelisted`)
- Request logs mask passwords and tokens. Chat prompts are logged by size only. Set `CHAT_DEBUG_PROMPTS=true` locally to see full prompts
- Login failures return one generic error, so the API does not reveal whether an email is registered
- Only admins create, edit, deactivate and re-role users. Admins cannot deactivate themselves or change their own role. An account deactivated by an admin cannot be revived through self-registration
- Managers can list couriers (needed for assignment) but nothing else about users
- Customers and couriers only ever see their own orders
- Knowledge base uploads are admin-only, and every document is checked before it is indexed (see [Knowledge base](#knowledge-base))
- Qdrant on the Droplet requires an API key

### Knowledge base

The assistant answers general questions from documents stored in Qdrant. Admins manage them in the **Upload document** tab (`POST /ingestion/upload`).

**Upload form.** The access rules and the topic are set in the form, never in the text of the file. Anything written inside the document (for example "Role: CUSTOMER") has no effect on access.

| Field | Meaning |
| --- | --- |
| File | `.txt`, `.pdf` or `.docx`, up to 5 MB |
| Document type | The topic: `AUTH`, `USER`, `RESTAURANT`, `MENU`, `DELIVERY`, `ORDER` or `SYSTEM` |
| Who sees the document in chat | One or more roles. Admin is not added automatically, tick it if admins should get answers from this document too |
| Language | `ru`, `en` or `de` |
| documentId | A permanent code of the document (not of the file). One document keeps one id forever |
| Version | An integer from 1 |

**Versions.** Uploading an existing `documentId` with a higher version replaces the document: the old version moves to the archive collection. The same or a lower version is rejected, so a fresh text is never overwritten by an old one.

**Safety check and quarantine.** Before indexing, a model checks the document. Anything that tries to give instructions to the assistant (ignore the rules, change roles, hide something from the user, dictate a particular answer, reveal internal instructions) is treated as unsafe. An unsafe document is not indexed. It is saved to the quarantine table and the upload answers `422`, which the UI shows as a message. The verdict of the model is written to the backend log. The check is done by a language model, so borderline texts can be judged differently from run to run.

**How the assistant picks documents.** The question is first classified into one document type, then the search runs only among chunks of that type that are allowed for the role of the asking user. If nothing is found, the assistant answers that the knowledge base has no information and does not call the model, so it cannot invent an answer.

| Type | Topic |
| --- | --- |
| `AUTH` | Registration, account confirmation, login |
| `USER` | User profile and what a user can do |
| `RESTAURANT` | Restaurants and information about them |
| `MENU` | Menus, dishes |
| `DELIVERY` | Delivery and the work of couriers |
| `ORDER` | Making an order, order contents, order rules and statuses |
| `SYSTEM` | General rules and capabilities of the system |

**Writing documents.**

- One topic per document: a document has one type, and a mixed document is found only by questions of that type
- Write plain facts in short sections. Do not address the assistant ("answer like this", "ignore that"), such text is flagged as unsafe
- Do not put a metadata block or the role into the text, it only pollutes the search

**Starter documents** are in `docs/knowledge-base/` (upload language `ru`, version `1`):

| File | Type | Roles | documentId |
| --- | --- | --- | --- |
| `auth-guide.txt` | `AUTH` | all four | `auth-guide` |
| `customer-guide.txt` | `USER` | Customer, Admin | `customer-guide` |
| `customer-orders-guide.txt` | `ORDER` | Customer, Admin | `customer-orders-guide` |
| `restaurants-guide.txt` | `RESTAURANT` | all four | `restaurants-guide` |
| `menu-guide.txt` | `MENU` | all four | `menu-guide` |
| `manager-restaurants-guide.txt` | `RESTAURANT` | Manager, Admin | `manager-restaurants-guide` |
| `manager-menu-guide.txt` | `MENU` | Manager, Admin | `manager-menu-guide` |
| `manager-orders-guide.txt` | `ORDER` | Manager, Admin | `manager-orders-guide` |
| `courier-guide.txt` | `DELIVERY` | Courier, Admin | `courier-guide` |
| `admin-users-guide.txt` | `USER` | Admin | `admin-users-guide` |
| `admin-system-guide.txt` | `SYSTEM` | Admin | `admin-system-guide` |

`docs/knowledge-base/demo/` holds files for demonstrating the safety check: one normal document that passes and three that end up in quarantine (an open "ignore the rules" instruction, a role escalation with a request to reveal internal prompts, and a hidden instruction inside an otherwise normal document). Each exists as `.txt` and `.pdf`. Do not upload the quarantine samples as real content.

The knowledge base of every environment is separate: the local Qdrant and the one on the Droplet do not synchronize, so the documents have to be uploaded in each of them.

### Chat

The assistant is available to every signed-in user as a floating button in the lower right corner.

It can work with:

- Knowledge base data from Qdrant
- Current order data from PostgreSQL, always scoped to the signed-in user: customers see their orders, couriers see their assigned orders, staff see all

How it works:

- `POST /chat` with `{ "message": "..." }` returns the answer as plain text. `DELETE /chat` clears the caller's history
- The question is classified first. Order questions use live data, everything else uses the knowledge base. If the classifier returns something unusable, the assistant falls back to a general answer instead of failing
- Knowledge base answers use only the retrieved context. If nothing is found for the question type and the role, a fixed "no information in the knowledge base" answer is returned without calling the model
- `CHAT_MIN_SCORE` (optional, off by default) drops retrieved chunks with a similarity score below the value. The retrieval log line (`Retrieval: type=..., chunks=..., scores=[...]`) shows real scores for tuning it
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
- Upload document tab (admin only): a form with file, type, roles, language, id and version, client-side checks (format, size, at least one role) and a collapsible guide on how to prepare a document
- Floating assistant with quick questions
- Registration and login. The confirmation link from the email opens `/?confirm=<code>` and the page confirms the registration by itself

The user role comes from `GET /auth/me`. The session is restored on page load and an expired access token is refreshed transparently.

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
| `QDRANT_URL` | **One** Qdrant address, for example `http://localhost:6333`. No commas, no `/dashboard` |
| `QDRANT_API_KEY` | Optional. Sent as the `api-key` header when set. Leave it empty for a local Qdrant without protection |
| `KNOWLEDGE_DB_COLLECTION_NAME`, `ARCHIVE_DB_COLLECTION_NAME` | Qdrant collections for active and archived document versions, for example `food_delivery` and `food_delivery-archive` |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | Chunking of documents, in words. The overlap must be smaller than the size |
| `CORS_ORIGINS` | Addresses of the frontend, comma separated, for example `http://localhost:5173`. Also used by the CSRF check |
| `CSRF_ALLOW_NO_ORIGIN` | `true` lets requests without an `Origin` header through (Postman, curl, tests). Local use only, never in production |
| `CHAT_MIN_SCORE` | Optional minimum similarity score of retrieved chunks, `0` (off) by default |
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

Set `QDRANT_URL=http://localhost:6333` (and leave `QDRANT_API_KEY` empty), restart the backend and upload the documents from `docs/knowledge-base/` in the **Upload document** tab as admin. The collections are created automatically when the backend starts. The Qdrant dashboard is at `http://localhost:6333/dashboard`. To try a different Qdrant without editing `.env`, override the variable for one run:

```powershell
$env:QDRANT_URL="http://localhost:6333"; npm run start:dev
```

#### Calling the API without a browser (Postman, curl)

State-changing requests need an `Origin` header that is listed in `CORS_ORIGINS`. For local testing either add that header to the request or set `CSRF_ALLOW_NO_ORIGIN=true` in your local `.env`.

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
| `VITE_API_URL` | Leave empty in development. In production, the public API URL (read at build time) |

The proxied paths are listed in `frontend/vite.config.ts`. **When you add a new top-level backend route, add it there too**, otherwise Vite answers `404`.

## Deployment (DigitalOcean)

The project runs in one DigitalOcean project with four resources:

| Component | DigitalOcean service | Notes |
| --- | --- | --- |
| Backend | App Platform app `fds-app` | NestJS API |
| Frontend | App Platform app `fds-frontend-app` | The built React SPA |
| Database | Managed PostgreSQL 18 (FRA1, 1 GB RAM) | `DB_SSL=true` |
| Vector database | Droplet (FRA1, 512 MB RAM) | Qdrant in Docker, protected with an API key |

```text
Browser ──► fds-frontend-app (static SPA)
   │
   └─ fetch with cookies (VITE_API_URL) ──► fds-app (NestJS)
                                              ├──► Managed PostgreSQL
                                              ├──► AI provider (answers, embeddings)
                                              └──► Qdrant on the Droplet (:6333, api-key)
```

### 1. Database

Create the managed PostgreSQL cluster and put its host, port, user, password and database name into the backend variables. Set `DB_SSL=true`. If the cluster restricts incoming connections, add the backend app as a trusted source. The schema is created by TypeORM (`synchronize: true`).

### 2. Qdrant on the Droplet

On the Droplet (with Docker installed), generate a key and start Qdrant with it. Run the two lines in one SSH session, and save the key in a password manager:

```bash
KEY=$(openssl rand -hex 32); echo $KEY
docker run -d --name qdrant --restart unless-stopped -p 6333:6333 -v qdrant_storage:/qdrant/storage -e QDRANT__SERVICE__API_KEY=$KEY qdrant/qdrant
```

The volume keeps the data when the container is recreated, `--restart unless-stopped` brings Qdrant back after a reboot. Check that the protection works:

```bash
curl -i http://localhost:6333/collections                         # 401 without the key
curl -i -H "api-key: <your key>" http://localhost:6333/collections   # 200 with the key
```

Open port 6333 in the DigitalOcean firewall of the Droplet. The dashboard (`http://<droplet-ip>:6333/dashboard`) asks for the key.

### 3. Backend (`fds-app`)

Set these environment variables in the app settings. Mark secrets as encrypted.

| Variable | Value |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | From the managed database |
| `DB_SSL` | `true` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Long random strings (encrypted) |
| `QDRANT_URL` | `http://<droplet-ip>:6333` |
| `QDRANT_API_KEY` | The key from step 2 (encrypted) |
| `KNOWLEDGE_DB_COLLECTION_NAME`, `ARCHIVE_DB_COLLECTION_NAME` | The collection names |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | Chunking settings |
| `CORS_ORIGINS` | The public address of the frontend app, without a trailing slash |
| `SERVER_HOST`, `SERVER_PORT` | Public address of the backend, used in the confirmation email link |
| AI provider and mail settings | As in `.env.example` |

Do not set `CSRF_ALLOW_NO_ORIGIN` and `CHAT_DEBUG_PROMPTS` in production. If `CORS_ORIGINS` is empty, every state-changing request, login included, is rejected with `403`.

When the backend starts it creates the two Qdrant collections if they do not exist. A wrong `QDRANT_URL` or `QDRANT_API_KEY` is not fatal at startup, it shows up later as errors in the chat and in uploads, so check the logs after the first deployment.

### 4. Frontend (`fds-frontend-app`)

Set `VITE_API_URL` to the public address of the backend. Vite reads it **at build time**, so changing it requires a new build of the frontend. The auth cookies are `Secure` and `SameSite=None`, which works because both apps are served over HTTPS.

### 5. Fill the knowledge base

Sign in as admin on the deployed frontend and upload the documents from `docs/knowledge-base/` in the **Upload document** tab. Then check:

- the number of points of the active collection grew in the Qdrant dashboard
- the assistant answers a question from each role's documents, and says that it has no information for questions outside the role

### Deployment checklist

1. Database created, backend variables set
2. Qdrant running with an API key, port open
3. Backend deployed, logs show no Qdrant errors
4. Frontend built with the right `VITE_API_URL`
5. `CORS_ORIGINS` contains the frontend address
6. Knowledge base uploaded, chat checked under every role

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

Run `npm test`, `npm run test:integration` and `npm run test:api` before every push. `npm run test:cov` prints the coverage.

What is covered: authentication and authorization (service, controller, guards, JWT, cookies), the CSRF Origin check, the CRUD services, controllers and DTO validation, the order business rules (access by role, status transitions, courier assignment, limits, item changes and totals), error handling, the audit log, the RAG pipeline (ingestion with the safety verdict, chunking, embeddings, Qdrant client with and without an API key, chat including the "nothing found" answer) and the live order data used by the assistant.

Not covered: browser end-to-end tests, the endpoint-by-role matrix against a live database and frontend tests.

Services that write to the audit log receive a mock `AuditService` (`{ record: jest.fn() }`) in their specs, so unit tests never touch the database. When you change a constructor or a repository method, update the matching mock, that is almost always the reason a spec breaks. Chat specs mock the Qdrant search: a test that expects a model answer must return at least one chunk, an empty result now produces the fixed "no information" answer.

The integration and API tests call the backend without a browser, so they send no `Origin` header. They need `CSRF_ALLOW_NO_ORIGIN=true` or an explicit `Origin` header.

## Known limitations

- `NEW` is both the cart and the request waiting for the manager, so a manager can accept an order while the customer is still adding dishes
- Couriers are assigned when the order becomes `READY`, and the free courier with the lowest id wins. If nobody is free, a manager assigns one by hand
- Refresh tokens and the chat history are kept in memory, so a backend restart signs everybody out and clears the history
- Lists of orders, order items and users are loaded and filtered in application code and are not paginated yet
- The database schema is synchronized by TypeORM (`synchronize: true`). Migrations are planned before any real production use
- Access denials (`403`), rate limit hits (`429`) and sign-outs are not in the audit log yet
- Prices are displayed in ₽ regardless of the data
- Qdrant is reached over plain HTTP, so the API key travels unencrypted. The key stops casual access, but real protection needs TLS (a reverse proxy with a domain in front of Qdrant) or a private network
- The Droplet has 512 MB of RAM, which is enough for a small knowledge base but not for a large one
- The knowledge base of the local Qdrant and the one on the Droplet are separate and have to be filled separately
- The document safety check is done by a language model and can give false positives or negatives. A quarantined document is stored without the model's reasoning, only a fixed reason, the verdict is in the backend log
- The search returns the nearest chunks of the right type and role even if they are only loosely related, unless `CHAT_MIN_SCORE` is set
- Document access is exactly the roles ticked in the upload form: Admin is not included automatically

## Roadmap

- Playwright end-to-end tests: role matrix in the UI, the full order flow, negative API checks
- Pagination and SQL-level filtering for large lists
- TLS in front of Qdrant (or a private network between the app and the Droplet)
- Persistent refresh tokens and per-account login lockout
- Migrations and a CI pipeline
- Deployment hardening (swap, log rotation, connection pool, audit retention)
- Reason of a quarantine verdict stored with the document, a list of quarantined documents in the admin UI

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `429 Too Many Requests` after several logins | Rate limit, wait a minute |
| `403 Invalid request origin` on every POST, login included | The address of the frontend is not in `CORS_ORIGINS` (or the variable is empty). Locally, the Vite address is `http://localhost:5173` |
| `403 Origin header is required` from Postman, curl or tests | Send an `Origin` header from `CORS_ORIGINS`, or set `CSRF_ALLOW_NO_ORIGIN=true` locally |
| The page is blank and Vite prints `http proxy error` | The backend is not running or has not finished restarting |
| A new endpoint returns `404` from the frontend | The path is missing in `frontend/vite.config.ts` (the upload endpoint needs `/ingestion`) |
| The backend does not start: `QDRANT_URL must be a single valid URL` | `QDRANT_URL` holds two addresses, a comma, a typo or lacks `http://` |
| Chat answers fail with `ECONNREFUSED ... :6333` | Qdrant is not running or `QDRANT_URL` is wrong. Start the container (on Windows, start Docker Desktop first) |
| Chat or upload fails with `401` or `403` from Qdrant | `QDRANT_API_KEY` is missing or does not match the key of the Qdrant container |
| Upload answers `422` "did not pass the safety check" | The document was quarantined. Look at the `model verdict` line in the backend log, and rewrite the text as plain facts without instructions to the assistant |
| Upload answers that the version is not newer | The same `documentId` already exists with an equal or higher version. Increase the version |
| The assistant says there is no information although the document is uploaded | The document type or the roles in the upload form do not match the question. Check the `Retrieval: type=..., chunks=...` log line and the payload in the Qdrant dashboard |
| The assistant gives answers from a document that was replaced | The old version is in the archive collection, not in the active one. Check the version of the points in the active collection |
| Confirmation email never arrives locally | Use `EMAIL_DRY_RUN=true` and copy the link from the backend log |
| Login works but the session is lost | Auth cookies are `Secure`. Use Chrome on `localhost`, or HTTPS elsewhere |

## Документация исходного кода

В исходном коде используются комментарии JSDoc/TSDoc для описания ответственности ключевых компонентов, публичных операций и важных полей модели данных. Основное внимание уделено доменным сущностям, сервисам бизнес-логики, аутентификации и авторизации, обработке документов, RAG-контексту, эмбеддингам и интеграции с Qdrant.

Комментарии к публичным методам по возможности фиксируют назначение операции, параметры, результат и существенные исключения. Они описывают контракт кода и не заменяют DTO-валидацию, Swagger-документацию REST API или тесты.

При изменении бизнес-логики обновляйте соответствующие комментарии вместе с кодом. Не добавляйте комментарии к очевидным строкам: документируйте решения, ограничения доступа, побочные эффекты и неочевидные правила предметной области.

