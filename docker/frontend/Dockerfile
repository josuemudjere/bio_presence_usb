FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml components.json tsconfig.json tsconfig.node.json vite.config.ts ./
COPY patches ./patches
COPY Frontend ./Frontend

RUN pnpm install --frozen-lockfile
RUN pnpm exec vite build

FROM nginx:1.27-alpine AS runtime

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]