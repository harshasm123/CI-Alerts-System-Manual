# CI Alert System - Quick Start Guide

## 🚀 Deploy in 10 Minutes

### Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install AWS CDK
npm install -g aws-cdk

# Install Python
sudo apt-get install -y python3-pip
pip3 install boto3

# Configure AWS
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output (json)
```

---

## Deployment Steps

### Step 1: Bootstrap CDK

```bash
bash check-bootstrap.sh
cd infrastructure
cdk bootstrap
cd ..
```

### Step 2: Deploy Infrastructure

```bash
bash deploy.sh

# Deploys 4 stacks:
# 1. CIAlertStack - Core (DynamoDB, Lambda, API Gateway, Cognito)
# 2. CIAlert-Frontend - S3 + CloudFront
# 3. CIAlert-Monitoring - CloudWatch
# 4. CIAlert-CICD - CodePipeline (optional)
```

### Step 3: Deploy Frontend with Authentication

```bash
bash deploy-cognito-frontend.sh

# This will:
# - Get Cognito config from stack outputs
# - Build React app with AWS Amplify authentication
# - Upload to S3
# - Invalidate CloudFront cache
```

### Step 4: Create Test User

```bash
# Get Cognito IDs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)

# Sign up user
aws cognito-idp sign-up \
  --client-id $USER_POOL_CLIENT_ID \
  --username test@example.com \
  --password Test123!

# Confirm user (skip email verification)
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com
```

### Step 5: Access Frontend

```bash
# Get CloudFront URL
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
FRONTEND_URL=$(aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.DomainName' --output text)

echo "Frontend: https://$FRONTEND_URL"

# Login with: test@example.com / Test123!
```

---

## Architecture

### Core Stack (CIAlertStack)
- **DynamoDB**: Insights, Watchlist, UserSettings tables
- **Lambda**: Processor, PubMed ingestion, API handlers
- **API Gateway**: REST API with Cognito authorizer
- **Cognito**: User Pool with email sign-in, auto-verify
- **EventBridge**: Daily ingestion schedule
- **SQS**: Event queue
- **S3**: Data bucket

### Frontend Stack
- **S3**: Static hosting
- **CloudFront**: CDN with HTTPS
- **React + AWS Amplify**: Authentication UI

### Monitoring Stack
- **CloudWatch**: Dashboards and alarms
- **SNS**: Alert notifications

### CI/CD Stack (Optional)
- **CodePipeline**: GitHub integration
- **CodeBuild**: Automated builds

---

## Cost Breakdown (Light Usage)

- **DynamoDB**: $1-5/month (On-Demand)
- **Lambda**: $0-2/month (Free tier: 1M requests)
- **API Gateway**: $3.50/month (1M requests)
- **S3**: $0.50/month (10GB)
- **CloudFront**: $1/month (10GB transfer)
- **Cognito**: Free (50,000 MAU)
- **CloudWatch**: $3/month

**Total: ~$10-15/month**

---

## Troubleshooting

### Bootstrap Issues
```bash
bash check-bootstrap.sh
# If errors, ensure region is us-east-1
export AWS_REGION=us-east-1
```

### Stack Failures
```bash
bash fix-rollback.sh  # Delete failed stacks
bash deploy.sh        # Redeploy
```

### Frontend 401 Errors
```bash
# Ensure user is confirmed
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com
```

### CloudFront Cache Issues
```bash
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
```

---

## Cleanup

```bash
# Delete all stacks
cd infrastructure
cdk destroy --all

# Or manually
aws cloudformation delete-stack --stack-name CIAlert-CICD
aws cloudformation delete-stack --stack-name CIAlert-Monitoring
aws cloudformation delete-stack --stack-name CIAlert-Frontend
aws cloudformation delete-stack --stack-name CIAlertStack

# Wait for completion
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack
```

---

## Features

✅ **Secure Authentication**: Cognito with email sign-in
✅ **Protected API**: All endpoints require JWT token
✅ **User Watchlists**: Per-user molecule tracking
✅ **AI Insights**: Bedrock Claude 3 Sonnet processing
✅ **Daily Alerts**: 9 AM email notifications
✅ **Modern UI**: React with AWS Amplify
✅ **Production Ready**: Monitoring, CI/CD, cost-optimized

---

## Password Requirements

- Minimum 8 characters
- Uppercase letter
- Lowercase letter
- Number
- Special character

Example: `Test123!`

---

## Next Steps

1. Add more molecules to watchlist
2. Configure email alerts (SES)
3. Add more data sources (FDA, EMA, WIPO)
4. Customize UI branding
5. Set up custom domain

See **COGNITO_SETUP.md** for detailed authentication guide.
