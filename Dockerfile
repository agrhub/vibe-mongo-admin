# Stage 1: Build Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json client/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY client/ ./
RUN pnpm run build

# Stage 2: Build Server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json server/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY server/ ./
RUN pnpm run build

# Stage 3: Production Release
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm

# Copy Server
COPY --from=server-builder /app/server/package*.json /app/server/pnpm-lock.yaml ./server/
WORKDIR /app/server
RUN pnpm install --prod

COPY --from=server-builder /app/server/dist ./dist


# Copy compiled Client to expected location
COPY --from=client-builder /app/client/dist /app/client/dist

# Expose Port
EXPOSE 4000

# Start
CMD ["node", "dist/index.js"]
