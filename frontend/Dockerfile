# =============================================================================
# HCL DX Composer Frontend - React Vite Application
# =============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments - use relative path for nginx proxy
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create error page
RUN echo '<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Service Unavailable</h1></body></html>' > /usr/share/nginx/html/50x.html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
