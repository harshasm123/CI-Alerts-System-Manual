# ALB Frontend Design Document

## Overview

This design implements a production-grade frontend hosting solution using AWS Application Load Balancer (ALB), ECS Fargate, and ECR. The frontend React application will be containerized with nginx and served through HTTPS via ALB, providing better security, reliability, and avoiding S3 website endpoint limitations.

## Architecture

```
User Browser
    ↓ (HTTPS)
Application Load Balancer
    ↓
Target Group
    ↓
ECS Fargate Service (2+ tasks)
    ↓
Frontend Container (nginx + React)
```

### Key Components:
- **ALB**: Entry point, handles HTTPS termination, health checks
- **ECS Fargate**: Serverless container orchestration
- **ECR**: Docker image registry
- **VPC**: Network isolation with public subnets
- **Security Groups**: Network access control

## Components and Interfaces

### 1. Docker Container

**Dockerfile** (multi-stage build):
```dockerfile
# Stage 1: Build React app
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf**:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing - all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Don't cache index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

### 2. CDK Stack (FrontendAlbStack)

**Resources**:
- VPC with public subnets (or use existing VPC)
- Application Load Balancer
- Target Group (port 80, HTTP)
- ECS Cluster
- ECS Task Definition
- ECS Fargate Service
- ECR Repository
- Security Groups
- IAM Roles

**Stack Structure**:
```typescript
export class FrontendAlbStack extends cdk.Stack {
  public readonly albUrl: string;
  public readonly ecrRepository: ecr.Repository;
  
  constructor(scope: Construct, id: string, props: FrontendAlbStackProps) {
    // 1. Create VPC or use existing
    // 2. Create ECR repository
    // 3. Create ALB
    // 4. Create Target Group
    // 5. Create ECS Cluster
    // 6. Create Task Definition
    // 7. Create ECS Service
    // 8. Configure health checks
    // 9. Output ALB DNS name
  }
}
```

### 3. Deployment Script

**deploy-alb-frontend.sh**:
```bash
#!/bin/bash
# 1. Get stack outputs (API URL, Cognito config)
# 2. Create .env file for React build
# 3. Build Docker image
# 4. Tag image with timestamp
# 5. Push to ECR
# 6. Update ECS service (force new deployment)
# 7. Wait for deployment to complete
# 8. Output ALB URL
```

## Data Models

### Environment Configuration

```typescript
interface FrontendConfig {
  REACT_APP_API_URL: string;
  REACT_APP_USER_POOL_ID: string;
  REACT_APP_USER_POOL_CLIENT_ID: string;
  REACT_APP_REGION: string;
}
```

### ECS Task Definition

```json
{
  "family": "ci-alert-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [{
    "name": "frontend",
    "image": "<ECR_URI>:latest",
    "portMappings": [{
      "containerPort": 80,
      "protocol": "tcp"
    }],
    "environment": [
      {"name": "API_URL", "value": "..."},
      {"name": "USER_POOL_ID", "value": "..."}
    ],
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3
    }
  }]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: ALB Health Check Success
*For any* deployed ECS task, when the ALB performs a health check on the /health endpoint, the response status code should be 200
**Validates: Requirements 4.2**

### Property 2: HTTPS Redirect
*For any* HTTP request to the ALB, the response should be a 301/302 redirect to the HTTPS equivalent URL
**Validates: Requirements 1.5**

### Property 3: Container Replacement on Failure
*For any* ECS task that fails health checks consecutively, the ECS service should terminate and replace it within the configured timeout period
**Validates: Requirements 2.4**

### Property 4: Environment Variable Injection
*For any* container start, all required environment variables (API_URL, USER_POOL_ID, USER_POOL_CLIENT_ID, REGION) should be present in the container environment
**Validates: Requirements 6.1, 6.2**

### Property 5: SPA Routing Support
*For any* valid React route path, when requested directly from the ALB, nginx should serve index.html with HTTP 200 status
**Validates: Requirements 1.2**

### Property 6: Static Asset Caching
*For any* static asset file (js, css, images), the HTTP response should include Cache-Control headers with long expiration
**Validates: Requirements (implicit performance requirement)**

### Property 7: Deployment Idempotency
*For any* deployment script execution, running it multiple times with the same code should result in the same deployed state
**Validates: Requirements 3.4**

## Error Handling

### Build Failures
- **Docker build fails**: Check Dockerfile syntax, ensure all files exist
- **npm install fails**: Verify package.json and package-lock.json are in sync
- **React build fails**: Check for TypeScript errors, missing dependencies

### Deployment Failures
- **ECR push fails**: Verify AWS credentials, ECR repository exists
- **ECS service update fails**: Check task definition, ensure sufficient resources
- **Health checks fail**: Verify nginx configuration, container port mapping

### Runtime Errors
- **Container crashes**: Check logs with `aws logs tail`, verify environment variables
- **502 Bad Gateway**: Target group has no healthy targets
- **503 Service Unavailable**: All containers are unhealthy or service is scaling

## Testing Strategy

### Unit Tests
- Test nginx configuration syntax
- Test Dockerfile build process locally
- Test React app builds successfully

### Integration Tests
- Deploy to test environment
- Verify ALB health checks pass
- Test HTTPS access
- Test SPA routing (direct URL access)
- Verify environment variables are injected

### Property-Based Tests
Not applicable for infrastructure deployment (properties are verified through monitoring and health checks)

### Manual Testing
1. Deploy the stack
2. Access ALB URL in browser
3. Verify HTTPS works
4. Test all React routes
5. Check browser console for errors
6. Verify API calls work
7. Test authentication flow

## Deployment Process

### Initial Deployment
```bash
# 1. Deploy infrastructure
cd infrastructure
npm run build
cdk deploy FrontendAlbStack --require-approval never

# 2. Build and deploy container
bash deploy-alb-frontend.sh
```

### Updates
```bash
# Just run the deployment script
bash deploy-alb-frontend.sh
```

### Rollback
```bash
# Revert to previous image
aws ecs update-service \
  --cluster ci-alert-cluster \
  --service frontend-service \
  --task-definition ci-alert-frontend:PREVIOUS_VERSION \
  --force-new-deployment
```

## Cost Estimation

### Monthly Costs (us-east-1):
- **ALB**: ~$16/month (base) + $0.008/LCU-hour
- **ECS Fargate**: 
  - 2 tasks × 0.25 vCPU × $0.04048/hour = ~$6/month
  - 2 tasks × 0.5 GB × $0.004445/GB-hour = ~$0.65/month
- **ECR**: $0.10/GB-month (minimal for frontend image)
- **Data Transfer**: $0.09/GB (first 10 TB)

**Total**: ~$23-25/month (vs ~$0.50/month for S3 static hosting)

## Security Considerations

1. **HTTPS Only**: ALB terminates SSL, containers use HTTP internally
2. **Security Groups**: ALB allows 80/443, containers only accept from ALB
3. **IAM Roles**: Minimal permissions for ECS task execution
4. **No Public IPs**: Containers in private subnets (if using NAT Gateway)
5. **Secrets**: Use AWS Secrets Manager for sensitive config (future enhancement)

## Monitoring and Logging

### CloudWatch Metrics
- ALB: Request count, latency, HTTP status codes
- ECS: CPU/memory utilization, task count
- Target Group: Healthy/unhealthy host count

### CloudWatch Logs
- Container logs: stdout/stderr from nginx
- ALB access logs: All HTTP requests (optional, additional cost)

### Alarms
- Unhealthy target count > 0
- ALB 5xx error rate > threshold
- ECS service desired count != running count

## Future Enhancements

1. **Auto Scaling**: Scale ECS tasks based on CPU/memory or ALB request count
2. **Custom Domain**: Use Route53 and ACM for custom domain with SSL
3. **WAF**: Add AWS WAF for DDoS protection and security rules
4. **CDN**: Add CloudFront in front of ALB for global distribution
5. **Blue/Green Deployment**: Use CodeDeploy for zero-downtime deployments
6. **Container Insights**: Enable for detailed container metrics
