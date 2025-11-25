#!/bin/bash

# Quick Deploy Script for CI Alert System
set -e

echo "🚀 Quick Deploy - CI Alert System"
echo ""

# Check AWS credentials
echo "✓ Checking AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "❌ AWS credentials not configured"; exit 1; }

REGION=$(aws configure get region)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "✓ Region: $REGION"
echo "✓ Account: $ACCOUNT_ID"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
cd infrastructure
npm install --silent
cd ..

# Build and deploy
echo "🏗️  Building infrastructure..."
cd infrastructure
npm run build

echo "🚀 Deploying to AWS..."
cdk bootstrap aws://${ACCOUNT_ID}/${REGION} 2>/dev/null || true
cdk deploy --require-approval never

cd ..

# Get outputs
echo ""
echo "📊 Getting deployment outputs..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name CIAlertStack \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text 2>/dev/null)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name CIAlertStack \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text 2>/dev/null)

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📍 API URL: $API_URL"
echo "👤 User Pool: $USER_POOL_ID"
echo ""
echo "🧪 Test with:"
echo "  curl ${API_URL}insights"
echo ""
echo "⚠️  Important: Enable Bedrock models in AWS Console"
echo "   AWS Console → Bedrock → Model Access → Enable Claude 3 Sonnet"
