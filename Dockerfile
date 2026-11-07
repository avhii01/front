# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# The API URL is baked into the bundle at build time (Vite env).
ARG VITE_API_URL=https://backend-pvco.onrender.com
ENV VITE_API_URL=${VITE_API_URL}

COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY frontend/ ./
RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
