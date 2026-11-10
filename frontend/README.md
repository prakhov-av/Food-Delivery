# Food Delivery — Frontend

SPA на Vite + React + TypeScript для backend-приложения доставки еды (NestJS).

## Запуск

1. Запустить backend из корня проекта (нужен PostgreSQL с БД `foodDelivery`):

   ```bash
   npm run start:dev
   ```

2. Наполнить БД тестовыми данными (однократно):

   ```bash
   node scripts/seed.js
   ```

3. Запустить frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Открыть http://localhost:5173

Все запросы к API проксируются dev-сервером Vite на `http://localhost:3000`
(см. `vite.config.ts`) — это нужно, потому что backend использует httpOnly-cookie
и не настроен CORS.

## Гостевой режим

На странице входа есть кнопка «Продолжить как гость». Она создаёт гостевую
сессию через `POST /guest-sessions`; секрет хранится в httpOnly-cookie
`guest-session` и во фронтенде не сохраняется.

Гость — это отдельное состояние доступа (`anon` | `guest` | `user`), а не
зарегистрированный CUSTOMER: у гостя нет `userId`. При перезагрузке страницы
режим восстанавливается через `GET /guest-sessions`.

Гостю доступны каталог, оформление заказа (`/guest-orders`) и выбор статуса
заказа по цепочке `NEW → ACCEPTED → COOKING → READY → DELIVERING → COMPLETED`.
Отмена гостю недоступна. Выход из гостевого режима — `POST /guest-sessions/revoke`.

## Тестовые аккаунты

Пароль у всех: `Qwerty123`

| Email                  | Роль      |
| ---------------------- | --------- |
| admin@delivery.dev     | ADMIN     |
| manager@delivery.dev   | MANAGER   |
| courier1@delivery.dev  | COURIER   |
| courier2@delivery.dev  | COURIER   |
| anna@example.com       | CUSTOMER  |
| boris@example.com      | CUSTOMER  |
| vera@example.com       | CUSTOMER  |

## Возможности

- Вход / выход (httpOnly-cookie, автообновление access-токена через `/auth/refresh`)
- Гостевой режим: чат, каталог, оформление заказа и выбор статуса
- Регистрация с подтверждением кодом (нужен работающий SMTP из `.env`)
- Рестораны: список, создание, переименование, деактивация
- Меню: список, создание, переименование, деактивация
- Блюда: список, создание, редактирование, деактивация
- Заказы: список, оформление, смена статуса, назначение курьера, добавление позиций
- Пользователи (ADMIN/MANAGER): список, создание, смена роли, деактивация

Роль текущего пользователя backend не отдаёт, поэтому интерфейс определяет её
косвенно: если доступен `GET /users` — показываются разделы для персонала.
