# CI Alert System - Deployment Guide

This guide provides step-by-step instructions for deploying the Competitive Intelligence Alert System on AWS.

## Prerequisites

### Required Tools
- AWS CLI v2 (configured with appropriate permissions)
- Node.js 18+ and npm
- Python 3.11+
- Docker
- Git

### AWS Permissions
Your AWS user/role needs the following permissions:
- Full access to: Lambda, API Gateway, DynamoDB, S3, SQS, SNS, SES
- ECS/Fargate, CloudFront, WAF, Cognito, EventBridge
- IAM role creation and management
- Bedrock model access
- CloudWatch and X-Ray

### AWS Service Limits
Ensure your account has sufficient limits for:
- Lambda concurrent executions (100+)
- DynamoDB tables (10+)
- API Gateway APIs (10+)
- ECS tasks (10+)

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd ci-alert-system

# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### Option 2: Manual Deployment

Follow the steps below for manual deployment with more control.

## Manual Deployment Steps

### Step 1: Environment Setup

```bash
# Set AWS region
export AWS_REGION=us-east-1

# Install AWS CDK
npm install -g aws-cdk

# Bootstrap CDK (one-time per account/region)
cdk bootstrap
```

### Step 2: Deploy Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy all stacks
cdk deploy --all --require-approval never
```

### Step 3: Set Up Bedrock Agent

```bash
# Get the data bucket name from CDK outputs
DATA_BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlert-Storage --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)

# Run Bedrock setup script
python3 scripts/setup_bedrock_agent.py --data-bucket $DATA_BUCKET --region $AWS_REGION
```

### Step 4: Deploy Frontend

```bash
# Get ECR repository URI
ECR_REPO=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' --output text)

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# Build and push Docker image
cd frontend
docker build -t ci-alert-frontend:latest .
docker tag ci-alert-frontend:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Update ECS service
aws ecs update-service --cluster ci-alert-cluster --service ci-alert-service --force-new-deployment
```

### Step 5: Configure Monitoring

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard --dashboard-name "CI-Alert-System" --dashboard-body file://monitoring/dashboard.json
```

## Post-Deployment Configuration

### 1. Configure SES for Email Notifications

```bash
# Verify sender email address
aws ses verify-email-identity --email-address noreply@yourdomain.com

# Update Lambda environment variables with verified email
aws lambda update-function-configuration --function-name ci-alert-daily-digest --environment Variables='{SENDER_EMAIL=noreply@yourdomain.com}'
```

### 2. Configure Cognito User Pool

```bash
# Get User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Auth --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)

# Create admin user (optional)
aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username admin --user-attributes Name=email,Value=admin@yourdomain.com --temporary-password TempPass123!
```

### 3. Test the System

```bash
# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-API --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' --output text)

echo "Frontend URL: https://$CLOUDFRONT_URL"
echo "API URL: $API_URL"
```

## Environment-Specific Deployments

### Development Environment

```bash
# Deploy with development settings
cdk deploy --all --context environment=dev
```

### Production Environment

```bash
# Deploy with production settings
cdk deploy --all --context environment=prod
```

## Troubleshooting

### Common Issues

#### 1. CDK Bootstrap Issues
```bash
# If bootstrap fails, try with explicit account/region
cdk bootstrap aws://ACCOUNT-ID/REGION
```

#### 2. Lambda Deployment Timeouts
```bash
# Increase timeout in CDK stack
# Check VPC configuration and endpoints
```

#### 3. ECS Service Won't Start
```bash
# Check ECS service logs
aws logs describe-log-groups --log-group-name-prefix /ecs/ci-alert

# Check task definition
aws ecs describe-task-definition --task-definition ci-alert-task
```

#### 4. Bedrock Access Issues
```bash
# Ensure Bedrock models are enabled in your region
aws bedrock list-foundation-models --region $AWS_REGION
```

### Debugging Commands

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name CIAlert-Compute

# View Lambda logs
aws logs tail /aws/lambda/ci-alert-processor --follow

# Check SQS queue
aws sqs get-queue-attributes --queue-url QUEUE_URL --attribute-names All

# Monitor DynamoDB
aws dynamodb scan --table-name ci-alert-insights --limit 5
```

## Cleanup

### Remove All Resources

```bash
# Delete CDK stacks (in reverse order)
cdk destroy --all --force

# Delete ECR images
aws ecr batch-delete-image --repository-name ci-alert-frontend --image-ids imageTag=latest

# Delete CloudWatch dashboard
aws cloudwatch delete-dashboards --dashboard-names CI-Alert-System

# Delete Bedrock Agent (manual cleanup required)
# Use AWS Console to delete agent and knowledge base
```

## Cost Optimization

### Estimated Monthly Costs (1000 users)
- **Compute**: $200 (Lambda + ECS)
- **Storage**: $50 (DynamoDB + S3)
- **AI/ML**: $300 (Bedrock usage)
- **Networking**: $100 (CloudFront + VPC Endpoints)
- **Total**: ~$650/month

### Cost Reduction Tips
1. Use VPC Endpoints instead of NAT Gateway (-$90/month)
2. Enable S3 Intelligent Tiering
3. Use DynamoDB On-Demand pricing
4. Implement Lambda ARM64 for better price/performance
5. Use Spot instances for non-critical workloads

## Security Considerations

### Network Security
- All compute resources in private subnets
- VPC Endpoints for AWS service communication
- WAF protection on CloudFront
- Security groups with least privilege

### Data Security
- Encryption at rest for all storage
- Encryption in transit (HTTPS/TLS)
- IAM roles with least privilege
- Cognito for user authentication

### Monitoring Security
- CloudTrail for API logging
- GuardDuty for threat detection
- Config for compliance monitoring

## Maintenance

### Regular Tasks
1. **Weekly**: Review CloudWatch alarms and metrics
2. **Monthly**: Update Lambda dependencies
3. **Quarterly**: Review and rotate access keys
4. **Annually**: Review architecture and costs

### Updates
```bash
# Update CDK
npm update -g aws-cdk

# Update Lambda dependencies
cd lambdas
pip install --upgrade -r requirements.txt

# Update frontend dependencies
cd frontend
npm update

# Redeploy
./deploy.sh
```

## Support

### Documentation
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [React Documentation](https://reactjs.org/docs/)

### Monitoring
- CloudWatch Dashboard: `CI-Alert-System`
- X-Ray Tracing: Enabled for all Lambda functions
- Cost Explorer: Monitor spending trends

### Logs
- Lambda logs: `/aws/lambda/ci-alert-*`
- ECS logs: `/ecs/ci-alert-frontend`
- API Gateway logs: Enabled with request/response logging