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
  '/chat',
];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      apiPaths.map((p) => [p, { target: backend, changeOrigin: true }]),
    ),
  },
});
