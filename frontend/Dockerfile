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

# Install all dependencies
RUN npm install --silent

# Copy source code
COPY . .

# Build the app with optimizations
RUN npm run build

# Production stage
FROM nginx:1.25-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built app to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Remove default nginx config and copy our custom one
RUN rm -f /etc/nginx/conf.d/default.conf
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

# Expose port 8080 (non-privileged port)
EXPOSE 8080

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health.json || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]