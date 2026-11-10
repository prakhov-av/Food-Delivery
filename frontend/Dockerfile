FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Базовый путь API. По умолчанию фронт ходит в /api — тот же origin,
# поэтому cookie остаются своими и мобильные браузеры их принимают.
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

FROM nginx:alpine

# Список корневых сертификатов нужен, чтобы nginx проверял сертификат backend.
RUN apk add --no-cache ca-certificates

# Адрес backend, на который nginx проксирует /api.
# Значение по умолчанию — боевой API, переопределяется переменной окружения.
ENV API_UPSTREAM=https://fds-app-cke6h.ondigitalocean.app
# Подставлять в шаблон только API_UPSTREAM: остальные $переменные — nginx.
ENV NGINX_ENVSUBST_FILTER="^API_"

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
