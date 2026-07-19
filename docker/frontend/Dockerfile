FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

ENV VITE_API_BASE_URL=/api

COPY package.json pnpm-lock.yaml components.json tsconfig.json tsconfig.node.json vite.config.ts ./
COPY patches ./patches
COPY Frontend ./Frontend

RUN pnpm config set fetch-retries 8 \
 && pnpm config set fetch-retry-factor 2 \
 && pnpm config set fetch-retry-mintimeout 10000 \
 && pnpm config set fetch-retry-maxtimeout 120000 \
 && pnpm config set network-timeout 300000 \
 && pnpm install --frozen-lockfile
RUN pnpm exec vite build

FROM nginx:1.27-alpine AS runtime

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]