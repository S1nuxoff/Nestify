# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build args become VITE_ env vars at build time
ARG VITE_BACKEND_URL
ARG VITE_TMDB_KEY
ARG VITE_TMDB_BASE=https://api.themoviedb.org/3
ARG VITE_TMDB_IMG=https://image.tmdb.org/t/p
ARG VITE_HDREZKA_URL=https://rezka.fi

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_TMDB_KEY=$VITE_TMDB_KEY
ENV VITE_TMDB_BASE=$VITE_TMDB_BASE
ENV VITE_TMDB_IMG=$VITE_TMDB_IMG
ENV VITE_HDREZKA_URL=$VITE_HDREZKA_URL

RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback — все роути повертають index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
