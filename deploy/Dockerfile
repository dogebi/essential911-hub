# --- stage 1: frontend (static snapshot build) ---
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN npm run build:static

# --- stage 2: backend ---
FROM rust:1.96-bookworm AS backend
WORKDIR /app
COPY backend/Cargo.toml backend/Cargo.lock* ./
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY data /app/data
RUN cargo build --release

# --- stage 3: runtime ---
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend /app/target/release/essential911-hub-api /app/hub-api
COPY --from=frontend /app/frontend/dist /app/dist
ENV HOST=0.0.0.0 \
    PORT=8099 \
    STATIC_DIR=/app/dist \
    RUST_LOG=info
EXPOSE 8099
CMD ["/app/hub-api"]
