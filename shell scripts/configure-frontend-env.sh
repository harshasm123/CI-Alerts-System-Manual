#!/bin/bash

# Configure Frontend Environment Variables
# This script fetches AWS resource IDs and updates frontend/.env

set -e

REGION=${AWS_REGION:-us-east-1}
STACK_NAME="CIAlertStack"

echo "🔍 Fetching AWS resource information..."

# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text 2>/dev/null)

# Get Cognito User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text 2>/dev/null)

# Get Cognito User Pool Client ID
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text 2>/dev/null)

# Check if values were retrieved
if [ -z "$API_URL" ] || [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ]; then
  echo "❌ Error: Could not retrieve all required values from CloudFormation"
  echo "   Make sure the stack '$STACK_NAME' is deployed in region '$REGION'"
  exit 1
fi

# Create .env file
cat > frontend/.env << EOF
# CI Alert System - Frontend Environment Variables
# Auto-generated on $(date)

# API Gateway URL
REACT_APP_API_URL=${API_URL}

# Cognito User Pool ID
REACT_APP_USER_POOL_ID=${USER_POOL_ID}

# Cognito User Pool Client ID
REACT_APP_USER_POOL_CLIENT_ID=${USER_POOL_CLIENT_ID}

# AWS Region
REACT_APP_REGION=${REGION}
EOF

echo "✅ Frontend environment configured successfully!"
echo ""
echo "📝 Configuration:"
echo "   API URL: $API_URL"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $USER_POOL_CLIENT_ID"
echo "   Region: $REGION"
echo ""
echo "Next steps:"
echo "1. cd frontend"
echo "2. npm install"
echo "3. npm start"
