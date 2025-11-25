# Manual Deployment Guide

Step-by-step deployment with full control over each component.

## Prerequisites

```bash
# Install tools
npm install -g aws-cdk
pip install boto3 requests beautifulsoup4 feedparser python-dateutil

# Configure AWS
aws configure
export AWS_REGION=us-east-1
```

## Step 1: Bootstrap CDK

```bash
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$AWS_REGION
```

## Step 2: Deploy Infrastructure Stacks

```bash
cd infrastructure
npm install
npm run build

# Deploy in order (dependencies)
cdk deploy CIAlert-Network --require-approval never
cdk deploy CIAlert-Storage --require-approval never
cdk deploy CIAlert-Auth --require-approval never
cdk deploy CIAlert-Compute --require-approval never
cdk deploy CIAlert-API --require-approval never
cdk deploy CIAlert-Frontend --require-approval never
cdk deploy CIAlert-Monitoring --require-approval never
cdk deploy CIAlert-CICD --require-approval never
```

## Step 3: Setup Bedrock Agent

```bash
# Get data bucket name
DATA_BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlert-Storage --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)

# Run setup script
python3 scripts/setup_bedrock_agent.py --data-bucket $DATA_BUCKET --region $AWS_REGION
```

## Step 4: Deploy Frontend Container

```bash
# Get ECR repository
ECR_REPO=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' --output text)

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# Build and push
cd frontend
docker build -t ci-alert-frontend .
docker tag ci-alert-frontend:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Update ECS service
aws ecs update-service --cluster ci-alert-cluster --service ci-alert-service --force-new-deployment
```

## Step 5: Configure SES

```bash
# Verify sender email
aws ses verify-email-identity --email-address noreply@yourdomain.com

# Check verification status
aws ses get-identity-verification-attributes --identities noreply@yourdomain.com
```

## Step 6: Create Admin User

```bash
# Get User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Auth --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin \
  --user-attributes Name=email,Value=admin@yourdomain.com \
  --temporary-password TempPass123!
```

## Step 7: Setup Monitoring

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "CI-Alert-System" \
  --dashboard-body file://monitoring/dashboard.json
```

## Step 8: Test Deployment

```bash
# Get URLs
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-API --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' --output text)

echo "Frontend: https://$CLOUDFRONT_URL"
echo "API: $API_URL"

# Test Lambda function
aws lambda invoke --function-name ci-alert-pubmed-ingestion --payload '{}' response.json
cat response.json
```

## Verification Checklist

- [ ] All CDK stacks deployed successfully
- [ ] Bedrock Agent created and prepared
- [ ] ECR image pushed and ECS service updated
- [ ] SES email verified
- [ ] Cognito admin user created
- [ ] CloudWatch dashboard created
- [ ] Lambda functions responding
- [ ] Frontend accessible via CloudFront
- [ ] API Gateway endpoints working

## Troubleshooting

### Stack Deployment Fails
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name CIAlert-Network

# View CDK diff
cdk diff CIAlert-Network
```

### Lambda Function Errors
```bash
# View logs
aws logs tail /aws/lambda/ci-alert-processor --follow

# Test function
aws lambda invoke --function-name ci-alert-processor --payload '{"test": true}' test-response.json
```

### ECS Service Issues
```bash
# Check service status
aws ecs describe-services --cluster ci-alert-cluster --services ci-alert-service

# View task logs
aws logs describe-log-groups --log-group-name-prefix /ecs/ci-alert
```

## Cleanup

```bash
# Destroy stacks in reverse order
cdk destroy CIAlert-CICD --force
cdk destroy CIAlert-Monitoring --force
cdk destroy CIAlert-Frontend --force
cdk destroy CIAlert-API --force
cdk destroy CIAlert-Compute --force
cdk destroy CIAlert-Auth --force
cdk destroy CIAlert-Storage --force
cdk destroy CIAlert-Network --force
```