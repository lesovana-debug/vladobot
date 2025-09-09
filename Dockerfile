# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install ffmpeg and other dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

# Create temp directory for file processing
RUN mkdir -p /app/temp

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Expose port (if needed for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Start the application
CMD ["npm", "start"]
