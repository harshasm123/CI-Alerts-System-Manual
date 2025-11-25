#!/bin/bash

# CI Alert System Deployment Script
set -e

echo "🚀 Starting CI Alert System Deployment"

# Configuration - Get region from AWS CLI config
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    echo "⚠️  No region configured in AWS CLI. Using us-east-1 as default."
    REGION="us-east-1"
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
DATA_BUCKET="ci-alert-data-${ACCOUNT_ID}-${REGION}"

echo "📋 Configuration:"
echo "  Region: $REGION"
echo "  Account ID: $ACCOUNT_ID"
echo "  Data Bucket: $DATA_BUCKET"

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js and npm."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

if ! command -v cdk &> /dev/null; then
    echo "📦 Installing AWS CDK..."
    npm install -g aws-cdk
fi

echo "✅ Prerequisites check complete"

# Step 1: Bootstrap CDK (if needed)
echo "🏗️  Bootstrapping CDK..."
cdk bootstrap aws://${ACCOUNT_ID}/${REGION} || echo "CDK already bootstrapped"

# Step 2: Install dependencies
echo "📦 Installing dependencies..."

# Infrastructure dependencies
cd infrastructure
npm install
cd ..

# Step 3: Build and deploy infrastructure
echo "🏗️  Building and deploying infrastructure..."
cd infrastructure
npm run build
cdk deploy --require-approval never
cd ..

# Step 4: Get stack outputs
echo "📋 Getting stack outputs..."
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")

# Step 5: Test deployment
echo "🧪 Testing deployment..."
if [ -n "$API_URL" ]; then
    echo "Testing API endpoint: $API_URL"
    curl -s "${API_URL}insights" > /dev/null && echo "  ✅ API is responding" || echo "  ⚠️  API not responding yet"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "====================="
echo ""
echo "📊 Stack Information:"
echo "  Region: $REGION"
echo "  Account: $ACCOUNT_ID"
if [ -n "$API_URL" ]; then
    echo "  API URL: $API_URL"
fi
if [ -n "$USER_POOL_ID" ]; then
    echo "  User Pool: $USER_POOL_ID"
fi
echo ""
echo "🧪 Test Commands:"
echo "  # Get insights"
echo "  curl ${API_URL}insights"
echo ""
echo "  # Add to watchlist"
echo "  curl -X POST ${API_URL}watchlist -H 'Content-Type: application/json' -d '{\"molecule\":\"Keytruda\"}'"
echo ""
echo "  # Trigger ingestion"
echo "  aws lambda invoke --function-name CIAlertStack-PubMedFunction --region $REGION response.json"
echo ""
echo "📝 Next Steps:"
echo "1. Enable Bedrock models: AWS Console → Bedrock → Model Access"
echo "2. Test API endpoints using commands above"
echo "3. Check CloudWatch logs for Lambda execution"
echo ""
echo "✅ CI Alert System is ready!"