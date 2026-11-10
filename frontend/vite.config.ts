import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// По умолчанию локальный backend. Для удалённого задай PROXY_TARGET при запуске.
const backend = process.env.PROXY_TARGET ?? 'http://localhost:3000';

const apiPaths = [
  '/auth',
  '/users',
  '/restaurants',
  '/menus',
  '/menu-items',
  '/orders',
  '/order-items',
  '/guest-sessions',
  '/guest-orders',
  '/chat',
  '/audit-logs',
  '/ingestion',
];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      /**
       * API живёт на том же origin, что и фронт (в проде это делает nginx).
       * В dev то же самое делает vite: префикс /api срезается,
       * backend получает привычные пути /auth, /guest-sessions и так далее.
       */
      '/api': {
        target: backend,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      ...Object.fromEntries(
        apiPaths.map((p) => [p, { target: backend, changeOrigin: true }]),
      ),
    },
  },
});
