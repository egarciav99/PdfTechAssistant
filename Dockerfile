# PDF Technical Assistant — imagen para instalar en los servidores de la empresa.
# Uso: ver docs/ENTREGA.md (opción B).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx vite build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/write-config.sh /docker-entrypoint.d/40-pdf-assistant-config.sh
RUN chmod +x /docker-entrypoint.d/40-pdf-assistant-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
