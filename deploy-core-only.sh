#!/bin/bash

# Deploy core system without Knowledge Base (bypasses CloudFormation hooks)
set -e

echo "🚀 Deploying core CI Alert System (without RAG)..."

# Use us-east-2 (Ohio) - typically has fewer restrictions
REGION="us-east-2"
export AWS_DEFAULT_REGION=$REGION
aws configure set region $REGION

echo "📍 Using region: $REGION"

# Bootstrap if needed
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION >/dev/null 2>&1; then
    echo "🏗️ Bootstrapping CDK..."
    cdk bootstrap aws://$ACCOUNT/$REGION
fi

cd infrastructure

# Deploy core stack only (no Knowledge Base, no Bedrock Agent)
echo "📦 Deploying core stack..."
cdk deploy CIAlertStack --require-approval never

echo "📦 Deploying frontend..."
cdk deploy CIAlert-Frontend --require-approval never

echo "📦 Deploying monitoring..."
cdk deploy CIAlert-Monitoring --require-approval never

cd ..

echo "✅ Core system deployed successfully!"
echo ""
echo "📋 What's working:"
echo "  ✓ API Gateway with Cognito auth"
echo "  ✓ DynamoDB tables (insights, watchlist)"
echo "  ✓ Lambda functions (PubMed, processor, digest)"
echo "  ✓ EventBridge rules (daily ingestion)"
echo "  ✓ Frontend (React app)"
echo "  ✓ Monitoring (CloudWatch)"
echo ""
echo "⚠️  What's missing (due to CloudFormation hooks):"
echo "  ✗ Knowledge Base (OpenSearch Serverless)"
echo "  ✗ Bedrock Agent (RAG chat)"
echo ""
echo "🧪 Test the core system:"
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
if [ -n "$API_URL" ]; then
    echo "  curl ${API_URL}insights"
fi
echo ""
echo "📝 Next steps:"
echo "1. Test core functionality"
echo "2. Contact AWS admin to disable CloudFormation hooks"
echo "3. Deploy Knowledge Base manually when hooks are disabled"