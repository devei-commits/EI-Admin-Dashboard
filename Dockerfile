# Production admin: static Vite build + nginx (fast on EC2 vs `vite dev` + bind mounts)
# Vite/Rollup can exceed Node's default heap → OOM. Raise if needed: --build-arg NODE_MEMORY_MB=8192
FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG NODE_MEMORY_MB=4096
ENV NODE_OPTIONS=--max-old-space-size=${NODE_MEMORY_MB}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
