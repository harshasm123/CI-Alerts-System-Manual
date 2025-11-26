#!/bin/bash

# Deploy Core Stacks Only (Skip Frontend with ALB)

set -e

echo "🚀 Deploying Core Stacks (without Frontend)"
echo ""

REGION=$(aws configure get region)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "📋 Configuration:"
echo "  Region: $REGION"
echo "  Account: $ACCOUNT_ID"
echo ""

# Clean up failed Frontend stack if exists
echo "🧹 Cleaning up failed Frontend stack..."
aws cloudformation delete-stack --stack-name CIAlert-Frontend --region $REGION 2>/dev/null || true
aws cloudformation wait stack-delete-complete --stack-name CIAlert-Frontend --region $REGION 2>/dev/null || true

# Deploy only core stacks (no Frontend)
echo "📦 Deploying 3 stacks (Core, Monitoring, CICD)..."
cd infrastructure
cdk deploy CIAlertStack CIAlert-Monitoring CIAlert-CICD --require-approval never
cd ..

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "✅ Deployed Stacks:"
echo "  ✓ CIAlertStack (DynamoDB, Lambda, API Gateway, Cognito)"
echo "  ✓ CIAlert-Monitoring (CloudWatch, Alarms)"
echo "  ✓ CIAlert-CICD (CodePipeline)"
echo "  ✗ CIAlert-Frontend (Skipped - ALB quota issue)"
echo ""
echo "📋 Get URLs:"
echo "  ./GET_URLS.sh"
echo ""
echo "💡 To deploy Frontend later:"
echo "  1. Request ALB quota increase: ./fix-alb-quota.sh"
echo "  2. Wait for approval (15-30 min)"
echo "  3. Run: cdk deploy CIAlert-Frontend"
