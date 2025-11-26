# Cognito-Integrated Frontend Setup

## Quick Deploy

```bash
# 1. Redeploy infrastructure with Cognito auth enabled
cd infrastructure
cdk deploy CIAlertStack

# 2. Deploy frontend
cd ..
bash deploy-cognito-frontend.sh
```

## Manual Steps

### 1. Update Infrastructure
The API now requires Cognito authentication. Redeploy:
```bash
cd infrastructure
cdk deploy CIAlertStack
```

### 2. Build and Deploy Frontend
```bash
cd frontend

# Get stack outputs
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
REGION=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`Region`].OutputValue' --output text)

# Create .env
cat > .env << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_REGION=$REGION
EOF

# Build
npm install
npm run build

# Upload
BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)
aws s3 sync build/ s3://$BUCKET/ --delete

# Invalidate cache
CLOUDFRONT=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT --paths "/*"
```

### 3. Create Test User
```bash
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)

# Sign up
aws cognito-idp sign-up \
  --client-id $USER_POOL_CLIENT_ID \
  --username test@example.com \
  --password Test123!

# Confirm (skip email verification)
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com
```

## Features

- **Sign Up/Sign In**: Email-based authentication
- **Email Verification**: Auto-verify on sign up
- **Secure API**: All endpoints require Cognito JWT token
- **Watchlist Management**: Add/remove molecules per user
- **Insights Dashboard**: View AI-generated insights

## Architecture

```
User → CloudFront → S3 (React App)
         ↓
    Cognito Auth
         ↓
    API Gateway (Cognito Authorizer)
         ↓
    Lambda → DynamoDB
```

## Password Requirements

- Minimum 8 characters
- Uppercase letter
- Lowercase letter
- Number
- Special character
