# Stage 1: Build Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build Server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# Stage 3: Production Release
FROM node:20-alpine
WORKDIR /app

# Copy Server dependencies and built output
COPY --from=server-builder /app/server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev

COPY --from=server-builder /app/server/dist ./dist

# Copy compiled Client to expected location
COPY --from=client-builder /app/client/dist /app/client/dist

# Expose Port
EXPOSE 4000

# Start
CMD ["node", "dist/index.js"]
