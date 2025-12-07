# Build stage
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Add build arguments for environment variables
ARG REACT_APP_API_URL
ARG REACT_APP_USER_POOL_ID
ARG REACT_APP_USER_POOL_CLIENT_ID
ARG REACT_APP_REGION

# Set environment variables
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_USER_POOL_ID=$REACT_APP_USER_POOL_ID
ENV REACT_APP_USER_POOL_CLIENT_ID=$REACT_APP_USER_POOL_CLIENT_ID
ENV REACT_APP_REGION=$REACT_APP_REGION
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false

# Copy package files
COPY package*.json ./

# Install dependencies with clean install for production
RUN npm ci --only=production --silent
RUN npm install --only=dev --silent

# Copy source code
COPY . .

# Build the app with optimizations
RUN npm run build

# Production stage
FROM nginx:1.25-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create nginx user and set permissions
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy built app to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create health check endpoint
RUN echo '{"status":"healthy","timestamp":"'$(date -Iseconds)'"}' > /usr/share/nginx/html/health.json

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Create pid directory
RUN mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/run/nginx

# Switch to non-root user
USER nginx

# Expose port 80 (standard HTTP port)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health.json || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]