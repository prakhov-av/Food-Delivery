FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# npm ci ставит пакеты строго по package-lock.json: сборка воспроизводима.
RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]