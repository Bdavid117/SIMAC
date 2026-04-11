FROM node:22.14.0-alpine3.21 AS builder

WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27.5-alpine3.21

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

