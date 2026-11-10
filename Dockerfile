FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# npm ci ставит пакеты строго по package-lock.json: сборка воспроизводима.
# npm 10.9.9 — та версия, которой собран package-lock.json. Без фиксации
# новая версия npm в образе может по-другому разрешить peer-зависимости
# и сломать `npm ci` на ровном месте.
RUN npm install --no-audit --no-fund --global npm@10.9.9 \
    && npm ci --no-audit --no-fund

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]