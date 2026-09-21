import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://localhost:3000';
const apiPaths = [
  '/auth',
  '/users',
  '/restaurants',
  '/menus',
  '/menu-items',
  '/orders',
  '/order-items',
];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(apiPaths.map((p) => [p, { target: backend }])),
  },
});
