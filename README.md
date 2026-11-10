# Food Delivery

v1.0.12

A food delivery service. Customers order from restaurants, managers confirm and cook, couriers deliver, admins keep an eye on everything. NestJS backend, React frontend, an assistant that answers from a knowledge base and knows your live orders, and an audit log of who did what.

The project runs on DigitalOcean (backend and frontend on App Platform, PostgreSQL as a managed database, Qdrant on a Droplet). See [Deployment](#deployment-digitalocean).

- Frontend: https://fds-frontend-app-v4kqn.ondigitalocean.app
- Backend API: https://fds-app-cke6h.ondigitalocean.app

This is an educational project. Demo accounts and demo data are for local development and presentations only.

## Stack and layout

Backend: NestJS 11, TypeORM 1.1, PostgreSQL 15+, Qdrant over HTTP (optional API key), JWT in httpOnly cookies, `@nestjs/throttler` rate limiting, CSRF Origin check for state-changing requests, Swagger, Winston, Nodemailer, Mammoth for DOCX, `pdf-parse` for PDF, `class-validator`. Frontend: Vite 6, React 18, TypeScript, a native `fetch` client with cookie auth and automatic token refresh, and a dev-server proxy. Tests: Jest, ESLint and Prettier.

```text
src/                    # Backend (NestJS + TypeORM)
├── ai/                 # AI provider clients, generation, embeddings
├── audit/              # Audit log: entity, service, interceptor, admin API
├── auth/               # Authentication, JWT, guards, roles
├── chat/               # The assistant: classification, RAG, live order data
├── confirmation-codes/ # Email confirmation
├── guest-sessions/     # Guest session lifecycle and cookie identity
├── embeddings/         # Embeddings service
├── ingestion/          # TXT, PDF, DOCX processing, safety check, quarantine
├── logging/            # Winston logging, secret masking
├── orders/             # Orders API, status rules, limits (validation/)
├── restaurants/ menus/ menu-items/ order-items/ users/   # Catalog and people
├── security/           # CSRF Origin check middleware
├── vector-storage/     # Qdrant client and storage
├── prompts/            # AI prompts
└── main.ts             # Entry point
frontend/               # React SPA (views per role, ChatWidget, api client)
test/                   # Integration / API tests
docs/knowledge-base/    # Starter documents for the assistant (+ demo/ for the safety check)
database-demo/          # Demo data for local DB
```

## What it does

### Roles

Four roles: `ADMIN`, `MANAGER`, `CUSTOMER`, `COURIER`. Access is enforced on the backend; the frontend only hides what the backend would reject anyway.

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

### API

Swagger is available at `/swagger`. The API covers auth (login, refresh, logout, current user), guest sessions, users, restaurants, menus (`?restaurantId=`), menu items (`?menuId=`), orders, order items, chat, ingestion and the audit log. Guest order access is scoped to the guest session and is currently used internally by the assistant; there are no separate guest-order REST routes. See [Guest functionality](docs/GUEST-FUNCTIONALITY.md).

### Orders

The order flow is built around a manager confirming the order before anything else happens:

```text
NEW ──► ACCEPTED ──► COOKING ──► READY ──► DELIVERING ──► COMPLETED
 │          │            │          │            │
 └──────────┴────────────┴──────────┴──► CANCELLED_STAFF   (manager, admin)
 └──────────┴────────────┘                CANCELLED_CUSTOMER (customer, until pickup)
                                  └──────► CANCELLED_COURIER  (courier, from READY or DELIVERING)
```

An admin can force any status. The rules live in `src/orders/validation/order-status-change.ts` and are mirrored in `frontend/src/types.ts`.

**Couriers.** When an order reaches `READY`, the system assigns a free courier automatically: an active courier who has no order in `READY` or `DELIVERING`. If nobody is free, the order stays unassigned and a manager or admin picks a courier by hand (`PATCH /orders/:id`). Manual assignment works until the order is closed.

**Cart behaviour.** A customer has one open order per restaurant, and another dish from the same restaurant goes into it. Dishes must belong to the restaurant of the order, an empty order cannot be accepted, the total is recalculated on the server whenever an item changes, and closed orders cannot be modified.

**Limits** (`src/orders/validation/order-limits.ts`): 20 units of one dish, 20 different items per order, 500 order total, 5 active orders per customer.

### Audit log

Every important action is written to the append-only `audit_logs` table: who (user id and role), what, on which object, the result (`SUCCESS`, `DENIED`, `FAILED`), IP, user agent and sanitized details. Passwords and tokens never reach the log.

Recorded events include logins (successful and failed), registration and confirmation, user management, catalog changes, orders (creation, every status change with `from` and `to`, courier assignment, automatic or manual), order item changes, knowledge base uploads (including failed and quarantined ones) and assistant queries (metadata only, never the text).

- `GET /audit-logs` is admin-only, paginated (`page`, `pageSize` up to 100) and filterable by `actorId`, `action`, `entityType`, `entityId`, `from` and `to`
- The admin UI has a **Journal** tab with filters and expandable details
- A failure to write an audit record never breaks the request itself, it is logged and the request goes on

### Security

- Rate limiting: 120 requests per minute overall, 10 per minute on login, registration, order creation and chat. When exceeded, the API answers `429`. The counter is keyed by the identity of the request (user, guest session, device) and not by the IP address: behind Cloudflare every visitor shares one address, so a per-IP counter would let one person block the whole site. A second counter by IP guards against spam from a single address, and login attempts are additionally limited per account
- CSRF protection: every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) must carry an `Origin` header that is listed in `CORS_ORIGINS`, otherwise the API answers `403`. A request without `Origin` is accepted when the browser marks it as same-origin (`Sec-Fetch-Site: same-origin`). This matters because the auth cookies are `SameSite=None`
- The real client address is taken from `X-Client-IP` (the frontend proxy passes it on) or from `CF-Connecting-IP`, so the audit log shows the address of the visitor, not the address of a Cloudflare edge node
- Request validation rejects unknown fields (`whitelist` and `forbidNonWhitelisted`)
- Request logs mask passwords and tokens. Chat prompts are logged by size only. Set `CHAT_DEBUG_PROMPTS=true` locally to see full prompts
- Login failures return one generic error, so the API does not reveal whether an email is registered
- Only admins create, edit, deactivate and re-role users. Admins cannot deactivate themselves or change their own role. An account deactivated by an admin cannot be revived through self-registration
- Managers can list couriers (needed for assignment) but nothing else about users
- Customers and couriers only ever see their own orders
- Guest sessions use an HttpOnly `guest-session` cookie; the database stores only a SHA-256 token hash. Guest order and chat data are isolated by guest-session id
- An invalid access-token cookie is not silently downgraded to a guest session
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

**How the assistant picks documents.** The question is classified into one document type, then the search runs only among chunks of that type that are allowed for the role of the asking user. If that search finds nothing, it is repeated over all types the role may read. If there is still nothing, the assistant answers that the knowledge base has no information and does not call the model, so it cannot invent an answer.

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

The catalog part of the knowledge base can also be rebuilt from a running API instead of being written by hand. The helpers live in `scripts/` and are part of the repository:

- `node scripts/generate-catalog-docs.mjs` reads the restaurants, menus and dishes through the API and writes `docs/knowledge-base/catalog/*.txt` together with `manifest.json`
- `node scripts/upload-knowledge.mjs` uploads every file from the manifest through `POST /ingestion/upload`

Both take their settings from the environment or from the `.env` file in the project root (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `BASE_URL`, `ORIGIN`, `DOCS_DIR`); for another file set `$env:ENV_FILE = '.env.prod'`. The uploader also understands `ONLY_PREFIX` (upload only the documents whose id starts with it) and `DRY_RUN=1` (show what would be uploaded without sending anything). The generated documents are not tracked in git, so rebuild them after a fresh clone.

The knowledge base of every environment is separate: the local Qdrant and the one on the Droplet do not synchronize, so the documents have to be uploaded in each of them.

### The assistant

The assistant is available to signed-in users and visitors with a guest session as a floating button in the lower right corner. It works with two kinds of data: the knowledge base in Qdrant, and current order data from PostgreSQL. Live order access is scoped to the authenticated user or the guest session; customers and guests see only their own orders, couriers see their assigned orders, and staff access follows their role permissions. Order questions work without Qdrant, knowledge base questions need it.

`POST /chat` with `{ "message": "..." }` returns the answer as plain text. `GET /chat/history` reads the caller's history; `DELETE /chat` clears the active chat context and `DELETE /chat/history` clears stored history. The caller is identified by the access-token cookie or, for a guest, by the `guest-session` cookie. See [Guest functionality](docs/GUEST-FUNCTIONALITY.md) for the session and ownership rules.

The assistant tries to spend as few model calls as it can. The checks run in this order:

1. **Fixed answers for greetings and small talk.** "Hi", "what can you do?" and similar phrases are answered from a prepared text. No model call, no search.
2. **Prompt-injection filter.** A request that tries to extract the assistant's own instructions ("show me your system prompt", "ignore all previous instructions") is refused with a fixed answer. Again no model call.
3. **Order fast path.** A question about a concrete order is recognized by its wording: an order number together with a phrase like "what's in", "status" or "when will it be delivered". Questions about the list of your orders ("what are my orders?", "show all orders") are recognized the same way. Both are answered straight from the database, so only the wording of the answer is generated: one model call instead of two.
4. **Everything else** goes through the classifier. It picks the document type, decides whether live order data is needed and rewrites the question when it only makes sense together with the history. If the classifier returns something unusable, the assistant falls back to a general answer instead of failing.

**Caches.** A classification is cached for ten minutes, so the same question in the same context does not pay for the classifier twice. Query embeddings are cached as well.

**Prefetching.** The embedding of the question is requested in parallel with the classification call, so the search can start as soon as the classification is known. It is skipped whenever the embedding would be wasted: for a question about an order (that one is answered from live data and needs no search) and for a follow-up, where the classifier rewrites the question and the embedding of the original wording is never used.

**History.** Conversation history is stored per owner: by user id for authenticated users and by guest session id for guests. The persisted chat log is retained for 30 days by default (`CHAT_HISTORY_RETENTION_DAYS`); recent messages are loaded separately for each owner. The assistant also remembers the order that was discussed last within the corresponding chat context, so "and what about it?" is understood as a question about that order.

**Measured effect.** On the local benchmark of 47 questions (14 about live orders, 33 from the knowledge base) the model calls per set went from 94 to 77. Greetings and injection attempts cost nothing at all, a live order question needs one call instead of two (median 2.3 s → 1.3 s), and a follow-up about an order still needs two calls, because the classifier has to resolve the reference to the last discussed order.

### Frontend

The frontend UI is role-based:

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

```bash
npm ci
```

Create your `.env` from the provided example (`Copy-Item .env.example .env` in PowerShell, `cp .env.example .env` otherwise). The variables you will touch most often:

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | PostgreSQL connection |
| `DB_SSL` | `true` for a managed database that requires TLS |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing secrets |
| `QDRANT_URL` | **One** Qdrant address, for example `http://localhost:6333`. No commas, no `/dashboard` |
| `QDRANT_API_KEY` | Optional. Sent as the `api-key` header when set. Leave it empty for a local Qdrant without protection |
| `KNOWLEDGE_DB_COLLECTION_NAME`, `ARCHIVE_DB_COLLECTION_NAME` | Qdrant collections for active and archived document versions |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | Chunking of documents, in words. The overlap must be smaller than the size |
| `CORS_ORIGINS` | Addresses of the frontend, comma separated, for example `http://localhost:5173`. Also used by the CSRF check |
| `CSRF_ALLOW_NO_ORIGIN` | `true` lets requests without an `Origin` header through (Postman, curl, tests). Local use only, never in production |
| `CHAT_MIN_SCORE` | Optional minimum similarity score of retrieved chunks, `0` (off) by default. See [Known limitations](#known-limitations) before setting it |
| `SERVER_HOST`, `SERVER_PORT` | Used to build the link in the confirmation email |
| `EMAIL_DRY_RUN` | `true` logs the confirmation link instead of sending an email |
| `CHAT_DEBUG_PROMPTS` | `true` logs full assistant prompts (local debugging only) |
| `GUEST_SESSION_TTL_DAYS` | Optional guest-session lifetime in days; defaults to `30` when unset or invalid |
| `CHAT_HISTORY_RETENTION_DAYS` | Optional persisted chat-history retention in days; defaults to `30` |
| `PORT` | Backend port, `3000` by default |

The AI provider and mail settings are listed in `.env.example`.

PostgreSQL has to be running before the backend starts (a Docker container is the easiest way). Then:

```bash
npm run start:dev      # http://localhost:3000
npm run seed           # demo data, accounts come from the seed
```

Never reuse the demo accounts outside local development.

#### Keeping `package-lock.json` in sync

The backend image installs packages with `npm ci`, which refuses to run when the lock file and `package.json` disagree. The lock file is built with **npm 10.9.9** (the version in `node:22-alpine`, pinned in the Dockerfile and in the `packageManager` field), because npm 12 resolves optional peer dependencies differently and silently drops them from the lock — after that `npm ci` fails in the image with `Missing: chokidar@3.6.0 from lock file`.

When a dependency changes, refresh the lock file with that version:

```bash
npm install --package-lock-only   # npm 10.9.9
```

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
npm run dev            # http://localhost:5173
```

In development the browser talks to Vite, and Vite proxies API calls to the backend (`http://localhost:3000` by default). Useful variables:

| Variable | Purpose |
| --- | --- |
| `PROXY_TARGET` | Backend address for the dev proxy, for example a remote server. Set it for one run only |
| `VITE_API_BASE` | Base path of the API. Leave it unset: the frontend calls `/api/*` on its own origin, and the proxy forwards it to the backend |

The frontend always talks to the API **on its own origin**, through the path `/api`. In development Vite proxies that path to the backend (`frontend/vite.config.ts`); in production nginx does it (`frontend/nginx.conf.template`). The proxy rewrites `/api/*` to the backend's own paths, so **a new top-level backend route needs no frontend change**.

## Local benchmark (not part of the repository)

The benchmark harness lives in `src/chat/benchmark/` and in the `scripts/bench-*.mjs` helpers, and all of them are listed in `.gitignore`. It is a private tool: nothing in the project depends on it, and it stays out of version control on purpose. The rest of `scripts/` (the knowledge base helpers) is tracked, see [Knowledge base](#knowledge-base).

It runs a fixed set of 47 questions against the real models and the real Qdrant and records, per question, how many calls each part of the assistant needed (model, embeddings, Qdrant), how long the question took and what kind of answer came back.

```powershell
$env:BENCH='1'; $env:BENCH_VERSION='c7'; $env:BENCH_RUNS='1'; $env:BENCH_ALLOW_REMOTE='1'
npx jest src/chat/benchmark --runInBand
```

- `BENCH=1` switches the suite on, `BENCH_VERSION` names the run, `BENCH_RUNS` sets the number of passes (2 by default)
- `BENCH_ALLOW_REMOTE=1` is required when `QDRANT_URL` points at a remote instance, the run refuses to start otherwise. Writes to Qdrant are blocked during a run
- `--runInBand` is required, the scenarios share state and have to keep their order
- Every run writes `benchmark-results/chat-<version>-<timestamp>.csv`. `scripts/bench-peek.mjs` prints it, `scripts/bench-status-diff.mjs` compares two runs, `scripts/bench-compare.mjs` summarizes all of them

The history for the follow-up questions is prepared once before the run, so a scenario costs exactly what the question costs. Set `BENCH_INLINE_SETUP=1` to get the old behaviour, where the setup turns are part of the scenario time.

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

## Deployment (DigitalOcean)

One DigitalOcean project with four resources:

| Component | DigitalOcean service | Notes |
| --- | --- | --- |
| Backend | App Platform app `fds-app` | NestJS API |
| Frontend | App Platform app `fds-frontend-app` | The built React SPA |
| Database | Managed PostgreSQL 18 (FRA1, 1 GB RAM) | `DB_SSL=true` |
| Vector database | Droplet (FRA1, 512 MB RAM) | Qdrant in Docker, protected with an API key |

```text
Browser ──► fds-frontend-app (static SPA + nginx)
   │
   └─ fetch /api/* with cookies (same origin) ──► nginx ──► fds-app (NestJS)
                                                        ├──► Managed PostgreSQL
                                                        ├──► AI provider (answers, embeddings)
                                                        └──► Qdrant on the Droplet (:6333, api-key)
```

The API is reached through the same origin as the frontend (`/api/*` on the frontend host). That is what keeps the auth cookies working on phones: with the API on a different domain the cookie is third-party, and iOS Safari and Chrome with third-party cookie blocking drop it, so the guest mode and the chat stop working on mobile.

**1. Database.** Create the managed PostgreSQL cluster and put its host, port, user, password and database name into the backend variables. Set `DB_SSL=true` and add the backend app as a trusted source if the cluster restricts incoming connections. The schema is managed by TypeORM migrations. Keep `synchronize: false`; do not use automatic schema synchronization in production. Apply pending migrations through the project's migration command as part of deployment.

**2. Qdrant on the Droplet.** With Docker installed, generate a key and start Qdrant with it. Run both lines in one SSH session and save the key in a password manager:

```bash
KEY=$(openssl rand -hex 32); echo $KEY
docker run -d --name qdrant --restart unless-stopped -p 6333:6333 -v qdrant_storage:/qdrant/storage -e QDRANT__SERVICE__API_KEY=$KEY qdrant/qdrant
```

The volume keeps the data when the container is recreated, `--restart unless-stopped` brings Qdrant back after a reboot. Open port 6333 in the Droplet firewall; the dashboard (`http://<droplet-ip>:6333/dashboard`) asks for the key.

**3. Backend (`fds-app`).** Set the variables from the table above plus the AI provider and mail settings, and mark the secrets as encrypted. Do not set `CSRF_ALLOW_NO_ORIGIN` and `CHAT_DEBUG_PROMPTS` in production. If `CORS_ORIGINS` is empty, every state-changing request, login included, is rejected with `403`. A wrong `QDRANT_URL` or `QDRANT_API_KEY` is not fatal at startup, it shows up later as errors in the chat and in uploads, so check the logs after the first deployment.

**4. Frontend (`fds-frontend-app`).** Nothing to configure for the API: the frontend calls `/api/*` on its own origin, and nginx inside the container forwards it to the backend. The backend address comes from the `API_UPSTREAM` environment variable (the image already carries the production address as the default; set it only if the backend lives elsewhere). The auth cookies are `Secure` and `SameSite=None`, which works because both apps are served over HTTPS.

> The old build argument `VITE_API_URL` is no longer used. If it is still set in the app spec, remove it: the frontend must not call the API directly, or the cookies become third-party again and break on phones.

**5. Fill the knowledge base.** Sign in as admin on the deployed frontend and upload the documents from `docs/knowledge-base/`. Then check that the number of points of the active collection grew in the Qdrant dashboard, that the assistant answers a question from each role's documents, and that it says it has no information for questions outside the role.

### Deployment checklist

1. Database created, backend variables set
2. Qdrant running with an API key, port open
3. Backend deployed, logs show no Qdrant errors
4. Frontend deployed, `API_UPSTREAM` points at the backend (the default is the production address)
5. `CORS_ORIGINS` contains the frontend address
6. Knowledge base uploaded, chat checked under every role
7. Guest mode and the chat checked on a phone

## Known limitations

- `NEW` is both the cart and the request waiting for the manager, so a manager can accept an order while the customer is still adding dishes
- Couriers are assigned when the order becomes `READY`, and the free courier with the lowest id wins. If nobody is free, a manager assigns one by hand
- Refresh tokens and the chat history are kept in memory, so a backend restart signs everybody out and clears the history
- Lists of orders, order items and users are loaded and filtered in application code and are not paginated yet
- The database schema is managed by TypeORM migrations (`synchronize: false`). Migration execution is an explicit deployment step; review pending migrations and their rollback behaviour before applying them
- Access denials (`403`), rate limit hits (`429`) and sign-outs are not in the audit log yet
- Prices are displayed in ₽ regardless of the data
- Qdrant is reached over plain HTTP, so the API key travels unencrypted. The key stops casual access, but real protection needs TLS (a reverse proxy with a domain in front of Qdrant) or a private network
- The Droplet has 512 MB of RAM, which is enough for a small knowledge base but not for a large one
- The knowledge base of the local Qdrant and the one on the Droplet are separate and have to be filled separately
- The document safety check is done by a language model and can give false positives or negatives. A quarantined document is stored without the model's reasoning, only a fixed reason, the verdict is in the backend log
- Document access is exactly the roles ticked in the upload form: Admin is not included automatically
- **The search returns the nearest chunks of the right type and role even if they are only loosely related.** `CHAT_MIN_SCORE` can drop weak chunks, but there is no value that separates the useful chunks from the useless ones: in the local benchmark the best chunk of a relevant question scored as low as 0.31, while a question with no answer in the knowledge base scored up to 0.45 (a question about changing a password matches the document about signing in). A global threshold therefore costs more relevant answers than it saves, and the threshold is left off. The open question is a per-document-type calibration, not a single number
- A question with no answer in the knowledge base is reported by the model itself ("I have no information about this"), so the exact wording, and with it the log kind, depends on the model. The answer could be normalized to a fixed text to make that deterministic

## Roadmap

- Playwright end-to-end tests: role matrix in the UI, the full order flow, negative API checks
- Pagination and SQL-level filtering for large lists
- TLS in front of Qdrant (or a private network between the app and the Droplet)
- Persistent refresh tokens and per-account login lockout
- A CI pipeline
- Deployment hardening (swap, log rotation, connection pool, audit retention)
- Reason of a quarantine verdict stored with the document, a list of quarantined documents in the admin UI
- Retrieval calibrated per document type, so that a question without an answer is caught without a model call

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `429 Too Many Requests` after several logins | Rate limit, wait a minute |
| The guest mode or the chat does not work on a phone, but works on a desktop | The API is called on a different domain, so the cookie is third-party and the mobile browser drops it. The frontend must call `/api/*` on its own origin (nginx forwards it to the backend) |
| `401 Guest session is required` right after entering the guest mode | The `guest-session` cookie did not reach the browser: check the `Set-Cookie` of `POST /api/guest-sessions` and that its `Path` is `/` |
| `403 Invalid request origin` on every POST, login included | The address of the frontend is not in `CORS_ORIGINS` (or the variable is empty). Locally, the Vite address is `http://localhost:5173` |
| `403 Origin header is required` from Postman, curl or tests | Send an `Origin` header from `CORS_ORIGINS`, or set `CSRF_ALLOW_NO_ORIGIN=true` locally |
| The page is blank and Vite prints `http proxy error` | The backend is not running or has not finished restarting |
| Every API call in production answers `404` | `API_UPSTREAM` points at the wrong address, or the frontend image still carries the old `VITE_API_URL` build argument and calls the API directly |
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

## Source code conventions

Public methods carry JSDoc/TSDoc comments that describe what the operation is for, its parameters, its result and the exceptions that matter. The focus is on the domain entities, the business logic, authentication and authorization, document processing, the RAG context, the embeddings and the Qdrant integration.

The comments describe the contract of the code. They do not replace DTO validation, the Swagger documentation of the REST API or the tests.

When the business logic changes, update the matching comments with it. Do not comment the obvious lines: document the decisions, the access rules, the side effects and the rules of the domain that are not obvious from the code.
