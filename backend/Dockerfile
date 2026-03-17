# =============================================================================
# HCL DX Composer Backend - Node.js Express Server
# =============================================================================
FROM node:20-alpine

# Install dependencies for native modules (sharp), health checks
RUN apk add --no-cache python3 make g++ curl vips-dev

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application source
COPY . .

# Create uploads directory
RUN mkdir -p /var/uploads && chmod 755 /var/uploads

# Expose the port
EXPOSE 3001

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app /var/uploads

USER nodejs

# Start the server
CMD ["node", "src/index.js"]
