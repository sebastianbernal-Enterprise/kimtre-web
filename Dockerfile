# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Install production dependencies only using npm ci
RUN npm install --omit=dev

# Stage 2: Runtime image
FROM node:20-alpine

WORKDIR /usr/src/app

# Set Node environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy installed production dependencies from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Copy application source files
COPY server.js ./
COPY index.html ./
COPY politica-cookies.html ./
COPY Política_de_Privacidad_Kimtre.html ./
COPY cookies-control.js ./
COPY assets ./assets

# Expose the configured port
EXPOSE 3000

# Set start command
CMD ["node", "server.js"]
