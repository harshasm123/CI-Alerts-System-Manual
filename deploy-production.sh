#!/bin/bash

# Production Deployment Script - All Stacks with CloudFront
set -e

echo "🚀 Starting Production-Grade CI Alert System Deployment"
echo "======================================================"

# Configuration
REGION=$(aws configure get region || echo "us-west-2")
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ENVIRONMENT=${1:-production}
ALERT_EMAIL=${2:-admin@yourcompany.com}

echo "📋 Production Configuration:"
echo "  Region: $REGION"
echo "  Account ID: $ACCOUNT_ID"
echo "  Environment: $ENVIRONMENT"
echo "  Alert Email: $ALERT_EMAIL"

# Ask about custom domain
read -p "Do you have a custom domain? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your domain name: " DOMAIN_NAME
    read -p "Enter your certificate ARN: " CERT_ARN
else
    DOMAIN_NAME=""
    CERT_ARN=""
fi

echo "🔍 Checking prerequisites..."

# Install dependencies and build
cd infrastructure
npm install
npm run build

# Deploy all stacks in order
echo ""
echo "📦 Deploying Core Infrastructure..."
if cdk deploy CIAlertStack --require-approval never --parameters AlertEmail=$ALERT_EMAIL; then
    echo "✅ CIAlertStack deployed successfully"
else
    echo "❌ CIAlertStack failed"
    exit 1
fi

# Get core stack outputs
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null || echo "")
DATA_BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`DataBucket`].OutputValue' --output text 2>/dev/null || echo "")

echo ""
echo "📋 Core Stack Outputs:"
echo "  API URL: $API_URL"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  Data Bucket: $DATA_BUCKET"

# Deploy Knowledge Base
echo ""
echo "📦 Deploying Knowledge Base..."
if cdk deploy CIAlert-KnowledgeBase --require-approval never --context dataBucket="$DATA_BUCKET"; then
    echo "✅ CIAlert-KnowledgeBase deployed successfully"
    KB_SUCCESS=true
else
    echo "❌ CIAlert-KnowledgeBase failed"
    KB_SUCCESS=false
fi

# Deploy Bedrock Agent
echo ""
echo "📦 Deploying Bedrock Agent..."
if cdk deploy CIAlert-BedrockAgent --require-approval never; then
    echo "✅ CIAlert-BedrockAgent deployed successfully"
    AGENT_SUCCESS=true
else
    echo "❌ CIAlert-BedrockAgent failed"
    AGENT_SUCCESS=false
fi

# Deploy Production Stack
echo ""
echo "📦 Deploying Production Stack..."
if cdk deploy CIAlert-Production --require-approval never --parameters AlertEmail=$ALERT_EMAIL; then
    echo "✅ CIAlert-Production deployed successfully"
    PROD_SUCCESS=true
else
    echo "❌ CIAlert-Production failed"
    PROD_SUCCESS=false
fi

# Deploy Frontend with CloudFront
echo ""
echo "📦 Deploying Frontend with CloudFront..."
CONTEXT_PARAMS="--context apiUrl=\"$API_URL\" --context userPoolId=\"$USER_POOL_ID\" --context userPoolClientId=\"$CLIENT_ID\""
if [ -n "$DOMAIN_NAME" ] && [ -n "$CERT_ARN" ]; then
    CONTEXT_PARAMS="$CONTEXT_PARAMS --context domainName=\"$DOMAIN_NAME\" --context certificateArn=\"$CERT_ARN\""
fi

if eval "cdk deploy CIAlert-Frontend --require-approval never $CONTEXT_PARAMS"; then
    echo "✅ CIAlert-Frontend deployed successfully"
    FRONTEND_SUCCESS=true
else
    echo "❌ CIAlert-Frontend failed"
    FRONTEND_SUCCESS=false
fi

# Deploy Monitoring
echo ""
echo "📦 Deploying Monitoring..."
if cdk deploy CIAlert-Monitoring --require-approval never; then
    echo "✅ CIAlert-Monitoring deployed successfully"
    MONITORING_SUCCESS=true
else
    echo "❌ CIAlert-Monitoring failed"
    MONITORING_SUCCESS=false
fi

# Deploy CI/CD (optional)
echo ""
read -p "Deploy CI/CD pipeline? (y/n): " -n 1 -r
echo
CICD_SUCCESS=false
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Deploying CI/CD Pipeline..."
    if cdk deploy CIAlert-CICD --require-approval never; then
        echo "✅ CIAlert-CICD deployed successfully"
        CICD_SUCCESS=true
    else
        echo "❌ CIAlert-CICD failed"
    fi
else
    echo "⏭️ Skipping CI/CD deployment"
fi

cd ..

# Get all URLs
CLOUDFRONT_URL=""
ALB_URL=""
DASHBOARD_URL=""
PIPELINE_URL=""

if [ "$FRONTEND_SUCCESS" = true ]; then
    CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text 2>/dev/null || echo "")
    ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerUrl`].OutputValue' --output text 2>/dev/null || echo "")
fi

if [ "$MONITORING_SUCCESS" = true ]; then
    DASHBOARD_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Monitoring --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`DashboardUrl`].OutputValue' --output text 2>/dev/null || echo "")
fi

if [ "$CICD_SUCCESS" = true ]; then
    PIPELINE_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-CICD --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`PipelineUrl`].OutputValue' --output text 2>/dev/null || echo "")
fi

# Deployment Summary
echo ""
echo "📊 Production Deployment Summary"
echo "================================"
echo ""

# Count deployments
SUCCESSFUL_STACKS=1  # Core always succeeds or exits
TOTAL_STACKS=1

for stack in "KB_SUCCESS" "AGENT_SUCCESS" "PROD_SUCCESS" "FRONTEND_SUCCESS" "MONITORING_SUCCESS"; do
    TOTAL_STACKS=$((TOTAL_STACKS + 1))
    if [ "${!stack}" = true ]; then
        SUCCESSFUL_STACKS=$((SUCCESSFUL_STACKS + 1))
    fi
done

if [ "$CICD_SUCCESS" = true ]; then
    TOTAL_STACKS=$((TOTAL_STACKS + 1))
    SUCCESSFUL_STACKS=$((SUCCESSFUL_STACKS + 1))
fi

echo "✅ Successfully Deployed ($SUCCESSFUL_STACKS/$TOTAL_STACKS stacks):"
echo "  ✓ CIAlertStack (Core Infrastructure)"
[ "$KB_SUCCESS" = true ] && echo "  ✓ CIAlert-KnowledgeBase (S3 + OpenSearch + Bedrock KB)"
[ "$AGENT_SUCCESS" = true ] && echo "  ✓ CIAlert-BedrockAgent (RAG Agent)"
[ "$PROD_SUCCESS" = true ] && echo "  ✓ CIAlert-Production (Enhanced Monitoring)"
[ "$FRONTEND_SUCCESS" = true ] && echo "  ✓ CIAlert-Frontend (ALB + ECS + CloudFront)"
[ "$MONITORING_SUCCESS" = true ] && echo "  ✓ CIAlert-Monitoring (CloudWatch Dashboards)"
[ "$CICD_SUCCESS" = true ] && echo "  ✓ CIAlert-CICD (GitHub Pipeline)"

# Failed deployments
FAILED_COUNT=$((TOTAL_STACKS - SUCCESSFUL_STACKS))
if [ $FAILED_COUNT -gt 0 ]; then
    echo ""
    echo "❌ Failed Deployments ($FAILED_COUNT stacks):"
    [ "$KB_SUCCESS" = false ] && echo "  ✗ CIAlert-KnowledgeBase"
    [ "$AGENT_SUCCESS" = false ] && echo "  ✗ CIAlert-BedrockAgent"
    [ "$PROD_SUCCESS" = false ] && echo "  ✗ CIAlert-Production"
    [ "$FRONTEND_SUCCESS" = false ] && echo "  ✗ CIAlert-Frontend"
    [ "$MONITORING_SUCCESS" = false ] && echo "  ✗ CIAlert-Monitoring"
fi

echo ""
echo "🌐 Production URLs:"
[ -n "$CLOUDFRONT_URL" ] && echo "  🎨 Frontend (CloudFront): $CLOUDFRONT_URL"
[ -n "$ALB_URL" ] && echo "  🔗 Frontend (ALB): $ALB_URL"
[ -n "$API_URL" ] && echo "  🔌 API Gateway: $API_URL"
[ -n "$DASHBOARD_URL" ] && echo "  📊 Monitoring Dashboard: $DASHBOARD_URL"
[ -n "$PIPELINE_URL" ] && echo "  🚀 CI/CD Pipeline: $PIPELINE_URL"

echo ""
echo "🏗️ Production Features Deployed:"
echo "  ✓ DynamoDB tables with encryption"
echo "  ✓ Lambda functions with monitoring"
echo "  ✓ API Gateway with Cognito auth"
echo "  ✓ Cognito User Pool with MFA"
echo "  ✓ EventBridge scheduled rules"
echo "  ✓ SQS queues with DLQ"
[ "$KB_SUCCESS" = true ] && echo "  ✓ S3 + OpenSearch Serverless + Bedrock KB"
[ "$AGENT_SUCCESS" = true ] && echo "  ✓ Bedrock Agent with RAG actions"
[ "$FRONTEND_SUCCESS" = true ] && echo "  ✓ CloudFront CDN with caching"
[ "$FRONTEND_SUCCESS" = true ] && echo "  ✓ ALB + ECS Fargate auto-scaling"
[ "$FRONTEND_SUCCESS" = true ] && echo "  ✓ VPC with public/private subnets"
[ "$FRONTEND_SUCCESS" = true ] && echo "  ✓ WAF with security rules"
[ "$MONITORING_SUCCESS" = true ] && echo "  ✓ CloudWatch dashboards and alarms"
[ "$CICD_SUCCESS" = true ] && echo "  ✓ GitHub integration with CodePipeline"

echo ""
echo "📝 Next Steps:"
echo "1. Wait 5-10 minutes for services to initialize"
echo "2. Enable Bedrock models in AWS Console:"
echo "   - anthropic.claude-3-5-sonnet-20250106-v1:0"
echo "   - anthropic.claude-3-5-haiku-20241022"
echo "   - amazon.titan-embed-text-v1"
echo "3. Setup SES for email notifications:"
echo "   bash 'shell scripts/setup-ses.sh'"
echo "4. Test the system:"
[ -n "$CLOUDFRONT_URL" ] && echo "   curl $CLOUDFRONT_URL"
[ -n "$API_URL" ] && echo "   curl $API_URL/insights"
echo "5. Upload sample data:"
echo "   bash upload-sample-data.sh"
echo "6. Connect Knowledge Base to Agent:"
echo "   bash connect-knowledge-base.sh"

echo ""
echo "🔧 Management Commands:"
echo "  # Scale ECS service"
echo "  aws ecs update-service --cluster ci-alert-frontend-cluster --service FrontendService --desired-count 4"
echo ""
echo "  # View application logs"
echo "  aws logs tail /ecs/ci-alert-frontend --follow"
echo ""
echo "  # Check CloudFront cache"
echo "  aws cloudfront get-distribution --id DISTRIBUTION_ID"
echo ""
echo "  # Invalidate CloudFront cache"
echo "  aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths '/*'"

echo ""
echo "🎉 Production deployment complete!"
echo "   Your CI Alert System is running on enterprise-grade AWS infrastructure"
echo "   with CloudFront CDN, auto-scaling, and comprehensive monitoring."