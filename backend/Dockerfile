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

# Create uploads directory with world-writable permissions
# This is needed because the host volume mount overwrites container permissions
RUN mkdir -p /var/uploads && chmod 777 /var/uploads

# Expose the port
EXPOSE 3001

# Start the server (running as root to handle volume mounts)
CMD ["node", "src/index.js"]
