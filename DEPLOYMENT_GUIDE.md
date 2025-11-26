# Complete Deployment Guide - CI Alert System with Cognito Authentication

## Overview

This guide covers deploying a production-grade CI Alert System with:
- Cognito authentication
- React frontend with AWS Amplify
- Protected API endpoints
- User-specific watchlists
- AI-powered insights

---

## Prerequisites

### Required Software
```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# AWS CDK
npm install -g aws-cdk

# Python 3
sudo apt-get install -y python3-pip
pip3 install boto3

# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### AWS Configuration
```bash
aws configure
# Access Key ID: YOUR_ACCESS_KEY
# Secret Access Key: YOUR_SECRET_KEY
# Region: us-east-1
# Output: json
```

---

## Step 1: Bootstrap CDK

```bash
# Check bootstrap status
bash check-bootstrap.sh

# Bootstrap if needed
cd infrastructure
cdk bootstrap
cd ..
```

**Expected Output:**
```
✅ CDKToolkit is healthy
✅ Bucket exists: s3://cdk-hnb659fds-assets-...
✅ Version: 21
```

---

## Step 2: Deploy Infrastructure

```bash
bash deploy.sh
```

**This deploys 4 stacks:**

### 1. CIAlertStack (Core)
- 3 DynamoDB tables (Insights, Watchlist, UserSettings)
- 4 Lambda functions (Processor, PubMed, Watchlist API, Insights API)
- API Gateway with Cognito authorizer
- Cognito User Pool (email sign-in, auto-verify)
- S3 bucket with intelligent tiering
- SQS queue
- EventBridge daily schedule

### 2. CIAlert-Frontend
- S3 bucket for static hosting
- CloudFront distribution with HTTPS
- OAI for secure S3 access

### 3. CIAlert-Monitoring
- CloudWatch Dashboard
- 3 CloudWatch Alarms (5xx errors, latency, Lambda errors)
- SNS topic for alerts

### 4. CIAlert-CICD (Optional)
- CodePipeline with GitHub source
- CodeBuild projects
- Automated deployments

**Deployment Time:** ~8-10 minutes

**Expected Output:**
```
🎉 Deployment Complete!
📊 Deployed Stacks:
  ✓ CIAlertStack (Core)
  ✓ CIAlert-Frontend (S3 + CloudFront)
  ✓ CIAlert-Monitoring (CloudWatch)
  ✓ CIAlert-CICD (CodePipeline)

📋 Stack Outputs:
  Region: us-east-1
  Account: 992167236365
  API URL: https://abc123.execute-api.us-east-1.amazonaws.com/prod/
  User Pool: us-east-1_ABC123
```

---

## Step 3: Deploy Frontend with Authentication

```bash
bash deploy-cognito-frontend.sh
```

**This script:**
1. Retrieves Cognito config from CloudFormation outputs
2. Creates `.env` file with API URL, User Pool ID, Client ID, Region
3. Installs npm dependencies (React, AWS Amplify)
4. Builds React app with authentication
5. Uploads to S3
6. Invalidates CloudFront cache

**Deployment Time:** ~3-5 minutes

**Expected Output:**
```
🚀 Deploying Cognito-Integrated Frontend...
✅ API URL: https://abc123.execute-api.us-east-1.amazonaws.com/prod/
✅ User Pool: us-east-1_ABC123
✅ Region: us-east-1
📦 Installing dependencies...
🔨 Building React app...
☁️ Uploading to S3...
🔄 Invalidating CloudFront cache...

✅ Deployment complete!

🌐 Frontend URL: https://d1234567890.cloudfront.net

📝 To create a test user:
   aws cognito-idp sign-up --client-id abc123 --username test@example.com --password Test123!
   aws cognito-idp admin-confirm-user --user-pool-id us-east-1_ABC123 --username test@example.com
```

---

## Step 4: Create Test User

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

**Expected Output:**
```json
{
    "UserConfirmed": false,
    "UserSub": "12345678-1234-1234-1234-123456789012"
}
```

---

## Step 5: Access Frontend

```bash
# Get CloudFront URL
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
FRONTEND_URL=$(aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.DomainName' --output text)

echo "Frontend: https://$FRONTEND_URL"
```

**Login Credentials:**
- Email: `test@example.com`
- Password: `Test123!`

---

## Frontend Features

### Authentication
- Sign up with email
- Sign in with email/password
- Auto-verify email (no verification code needed)
- Secure JWT token management
- Auto-refresh tokens

### Watchlist Management
- Add molecules to personal watchlist
- Remove molecules from watchlist
- View all molecules in watchlist
- Per-user isolation (userId from Cognito)

### Insights Dashboard
- View AI-generated insights
- Filter by molecule
- Sort by timestamp
- Real-time updates

---

## Architecture

```
User → CloudFront (HTTPS)
         ↓
    S3 (React App)
         ↓
    Cognito (Authentication)
         ↓
    API Gateway (Cognito Authorizer)
         ↓
    Lambda (Watchlist/Insights API)
         ↓
    DynamoDB (User Data)
```

---

## API Endpoints (Protected)

All endpoints require `Authorization` header with Cognito JWT token.

### GET /insights
Returns insights for all molecules.

**Request:**
```bash
curl https://API_URL/insights \
  -H "Authorization: JWT_TOKEN"
```

**Response:**
```json
{
  "insights": [
    {
      "molecule": "Keytruda",
      "timestamp": "2024-01-15T10:30:00Z",
      "summary": "FDA approval for new indication...",
      "impact": "high"
    }
  ]
}
```

### GET /watchlist?userId=USER_ID
Returns user's watchlist.

**Request:**
```bash
curl "https://API_URL/watchlist?userId=test@example.com" \
  -H "Authorization: JWT_TOKEN"
```

**Response:**
```json
{
  "watchlist": ["Keytruda", "Opdivo", "Tecentriq"]
}
```

### POST /watchlist
Adds molecule to watchlist.

**Request:**
```bash
curl -X POST https://API_URL/watchlist \
  -H "Authorization: JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test@example.com","molecule":"Keytruda"}'
```

**Response:**
```json
{
  "message": "Added to watchlist"
}
```

### DELETE /watchlist?userId=USER_ID&molecule=MOLECULE
Removes molecule from watchlist.

**Request:**
```bash
curl -X DELETE "https://API_URL/watchlist?userId=test@example.com&molecule=Keytruda" \
  -H "Authorization: JWT_TOKEN"
```

**Response:**
```json
{
  "message": "Removed from watchlist"
}
```

---

## Troubleshooting

### Issue: Frontend shows 401 Unauthorized

**Cause:** User not confirmed or token expired.

**Fix:**
```bash
# Confirm user
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com

# Or sign out and sign in again
```

### Issue: Frontend not loading

**Cause:** CloudFront cache not invalidated.

**Fix:**
```bash
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
```

### Issue: API returns 403 Forbidden

**Cause:** Cognito authorizer rejecting token.

**Fix:**
1. Check token is valid (not expired)
2. Ensure user is confirmed
3. Verify User Pool ID matches in frontend `.env`

### Issue: Bootstrap fails

**Cause:** CloudFormation hooks in us-west-2.

**Fix:**
```bash
export AWS_REGION=us-east-1
aws configure set region us-east-1
cd infrastructure
cdk bootstrap
```

---

## Cost Breakdown

### Monthly Costs (Light Usage)
- **DynamoDB**: $1-5 (On-Demand, 1M reads/writes)
- **Lambda**: $0-2 (Free tier: 1M requests)
- **API Gateway**: $3.50 (1M requests)
- **S3**: $0.50 (10GB storage)
- **CloudFront**: $1 (10GB transfer)
- **Cognito**: Free (50,000 MAU)
- **CloudWatch**: $3 (10 metrics, 10 alarms)
- **SQS**: Free (1M requests)
- **EventBridge**: Free (1M events)

**Total: ~$10-15/month**

---

## Security Features

✅ **Authentication**: Cognito with email sign-in
✅ **Authorization**: JWT tokens on all API endpoints
✅ **Encryption**: S3 and DynamoDB encrypted at rest
✅ **HTTPS**: CloudFront with TLS 1.2+
✅ **CORS**: Restricted to CloudFront origin
✅ **IAM**: Least privilege Lambda roles
✅ **Password Policy**: 8+ chars, uppercase, lowercase, number, symbol

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

# Delete Cognito users (optional)
aws cognito-idp delete-user-pool --user-pool-id $USER_POOL_ID
```

---

## Next Steps

1. **Add More Users**: Use Cognito console or CLI
2. **Configure Email Alerts**: Set up SES for daily digests
3. **Add Data Sources**: Integrate FDA, EMA, WIPO APIs
4. **Custom Domain**: Add Route53 and ACM certificate
5. **Monitoring**: Set up CloudWatch alarms and SNS notifications
6. **CI/CD**: Configure GitHub webhooks for auto-deploy

---

## Support

- **Quick Start**: See `QUICKSTART.md`
- **Cognito Setup**: See `COGNITO_SETUP.md`
- **Architecture**: See `README.md`
- **Healthcare Context**: See `USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md`
