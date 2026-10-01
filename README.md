# Food Delivery

v1.0.12

Food delivery service with a NestJS backend, React frontend and RAG-based chat on the backend.

## Project structure

```text
Food-Delivery/
├── src/                    # Backend (NestJS + TypeORM)
│   ├── ai/                 # AI: chat, embeddings, RAG
│   ├── auth/               # Authentication and JWT
│   ├── chat/               # RAG chat
│   ├── confirmation-codes/ # Email confirmation
│   ├── email/              # Email service
│   ├── embeddings/         # Qdrant integration
│   ├── ingestion/          # TXT, PDF, DOCX processing
│   ├── exceptions/         # Global error handling
│   ├── logging/            # Winston logging
│   ├── restaurants/        # Restaurants API
│   ├── menus/              # Menus API
│   ├── menu-items/         # Menu items API
│   ├── orders/             # Orders API
│   ├── order-items/        # Order items API
│   ├── users/              # Users
│   ├── vector-storage/     # Qdrant storage
│   ├── prompts/            # AI prompts
│   └── main.ts             # Entry point
├── frontend/               # React SPA
│   └── src/
│       ├── views/          # UI by role
│       ├── api.ts          # HTTP client
│       ├── App.tsx         # Main component
│       └── styles.css
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
- Axios
- Vite dev-server proxy

### Development

- Jest
- ESLint + Prettier
- ts-node for seed scripts

## What's included

### Authentication

- Email confirmation with OTP codes
- JWT with httpOnly cookies
- Refresh token endpoint
- 4 roles: `ADMIN`, `MANAGER`, `CUSTOMER`, `COURIER`
- Role-based access control

### Core API

Currently there are 43 API endpoints covering:

- Users
- Restaurants
- Menus
- Menu items
- Orders
- Order items

Swagger documentation is also available.

### RAG

- TXT, PDF and DOCX ingestion
- Content moderation before indexing
- Document versioning
- Embeddings stored in Qdrant

### Chat

The RAG chat is currently implemented on the backend.

It can work with:

- Knowledge base data from Qdrant
- Current order data from PostgreSQL

The frontend chat UI is not implemented yet.

### Frontend

The frontend UI is role-based and currently includes:

- Restaurant management
- Menu and menu item management
- Order management
- Staff user creation
- Registration and login

The user role is detected through the `/users` endpoint availability.

## Recent changes

| Date | Developer | Change |
| --- | --- | --- |
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

The example environment variables are already available in `.env.example`.

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

## Commands

```bash
npm run start:dev         # Start with hot reload
npm run build             # Build the project
npm run start:prod        # Start in production mode
npm run lint              # Run ESLint
npm run format            # Run Prettier

npm test                  # Unit tests
npm run test:integration  # Integration tests
npm run test:cov          # Test coverage
npm run test:api          # API tests
```