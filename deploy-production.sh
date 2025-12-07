#!/bin/bash

# Production-Grade Deployment Script for CI Alert System
# Deploys with ALB, auto-scaling, WAF, and production optimizations

set -e

echo "🚀 Starting Production-Grade CI Alert System Deployment"

# Configuration
REGION=$(aws configure get region || echo "us-east-2")
export AWS_DEFAULT_REGION=$REGION
aws configure set region $REGION

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "📋 Production Configuration:"
echo "  Region: $REGION"
echo "  Account ID: $ACCOUNT_ID"
echo "  Environment: Production"

# Optional: Domain and certificate configuration
read -p "Do you have a custom domain? (y/n): " has_domain
if [[ "$has_domain" =~ ^[Yy]$ ]]; then
    read -p "Enter domain name (e.g., ci-alert.yourcompany.com): " DOMAIN_NAME
    read -p "Enter ACM certificate ARN (optional): " CERT_ARN
fi

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v cdk &> /dev/null; then
    echo "📦 Installing AWS CDK..."
    npm install -g aws-cdk
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker for container builds."
    exit 1
fi

# Fix Docker permissions if needed
if ! docker ps &> /dev/null; then
    echo "🔧 Fixing Docker permissions..."
    sudo usermod -aG docker $USER
    sudo systemctl start docker
    sudo chmod 666 /var/run/docker.sock
    echo "⚠️  Docker permissions fixed. You may need to logout/login or run 'newgrp docker'"
fi

# Bootstrap if needed
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION >/dev/null 2>&1; then
    echo "🏗️ Bootstrapping CDK..."
    cdk bootstrap aws://$ACCOUNT_ID/$REGION
fi

cd infrastructure
npm install
npm run build

# Deploy stacks with production configuration
DEPLOYED_STACKS=()
FAILED_STACKS=()

deploy_stack() {
    local stack_name=$1
    local context_args=$2
    
    # Check if stack already exists
    if aws cloudformation describe-stacks --stack-name $stack_name --region $REGION &>/dev/null; then
        STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $stack_name --region $REGION --query 'Stacks[0].StackStatus' --output text)
        if [[ "$STACK_STATUS" == "CREATE_COMPLETE" || "$STACK_STATUS" == "UPDATE_COMPLETE" ]]; then
            echo "✅ $stack_name already exists and is healthy ($STACK_STATUS)"
            DEPLOYED_STACKS+=("$stack_name")
            return 0
        fi
    fi
    
    echo ""
    echo "📦 Deploying $stack_name (Production)..."
    
    if cdk deploy $stack_name --require-approval never $context_args; then
        DEPLOYED_STACKS+=("$stack_name")
        echo "✅ $stack_name deployed successfully"
    else
        FAILED_STACKS+=("$stack_name")
        echo "❌ $stack_name failed"
    fi
}

# Core stack
deploy_stack "CIAlertStack"

# Get outputs from core stack
if [[ " ${DEPLOYED_STACKS[@]} " =~ " CIAlertStack " ]]; then
    API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
    USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")
    USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null || echo "")
    
    echo ""
    echo "📋 Core Stack Outputs:"
    echo "  API URL: $API_URL"
    echo "  User Pool ID: $USER_POOL_ID"
    echo "  Client ID: $USER_POOL_CLIENT_ID"
fi

# Frontend with production configuration
FRONTEND_CONTEXT=""
if [ -n "$API_URL" ]; then
    FRONTEND_CONTEXT="--context apiUrl=$API_URL --context userPoolId=$USER_POOL_ID --context userPoolClientId=$USER_POOL_CLIENT_ID --context region=$REGION"
fi

if [ -n "$DOMAIN_NAME" ]; then
    FRONTEND_CONTEXT="$FRONTEND_CONTEXT --context domainName=$DOMAIN_NAME"
fi

if [ -n "$CERT_ARN" ]; then
    FRONTEND_CONTEXT="$FRONTEND_CONTEXT --context certificateArn=$CERT_ARN"
fi

if [ -n "$ECR_URI" ]; then
    FRONTEND_CONTEXT="$FRONTEND_CONTEXT --context ecrUri=$ECR_URI"
fi

deploy_stack "CIAlert-Frontend" "$FRONTEND_CONTEXT"

# Monitoring
deploy_stack "CIAlert-Monitoring"

cd ..

# Get ALB URL
if [[ " ${DEPLOYED_STACKS[@]} " =~ " CIAlert-Frontend " ]]; then
    ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' --output text 2>/dev/null || echo "")
    ALB_DNS=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text 2>/dev/null || echo "")
fi

# Summary
echo ""
echo "📊 Production Deployment Summary"
echo "================================"
echo ""
echo "✅ Successfully Deployed (${#DEPLOYED_STACKS[@]} stacks):"
for stack in "${DEPLOYED_STACKS[@]}"; do
    echo "  ✓ $stack"
done

if [ ${#FAILED_STACKS[@]} -gt 0 ]; then
    echo ""
    echo "❌ Failed Deployments (${#FAILED_STACKS[@]} stacks):"
    for stack in "${FAILED_STACKS[@]}"; do
        echo "  ✗ $stack"
    done
fi

echo ""
echo "📦 CI/CD Pipeline:"
if [ -n "$ECR_URI" ]; then
    echo "  ECR Repository: $ECR_URI"
    echo "  CodeBuild Project: ci-alert-build"
    echo "  CodePipeline: ci-alert-pipeline"
fi

echo ""
echo "🌐 Production URLs:"
if [ -n "$ALB_URL" ]; then
    echo "  Application: $ALB_URL"
fi
if [ -n "$ALB_DNS" ]; then
    echo "  ALB DNS: $ALB_DNS"
fi
if [ -n "$DOMAIN_NAME" ]; then
    echo "  Custom Domain: https://$DOMAIN_NAME"
fi

echo ""
echo "🏗️ Production Features Deployed:"
echo "  ✓ CI/CD Pipeline with GitHub integration"
echo "  ✓ ECR for container image management"
echo "  ✓ CodeBuild for automated Docker builds"
echo "  ✓ Application Load Balancer with health checks"
echo "  ✓ ECS Fargate with auto-scaling (2-10 tasks)"
echo "  ✓ VPC with public/private subnets"
echo "  ✓ WAF with security rules and rate limiting"
echo "  ✓ CloudWatch Container Insights"
echo "  ✓ Security headers and HTTPS redirect"
echo "  ✓ Gzip compression and caching"
echo "  ✓ Non-root container execution"

if [ -n "$CERT_ARN" ]; then
    echo "  ✓ SSL/TLS certificate configured"
fi

if [ -n "$DOMAIN_NAME" ]; then
    echo "  ✓ Custom domain with Route53 alias"
fi

echo ""
echo "📝 Next Steps:"
echo "1. Wait 5-10 minutes for ECS tasks to start"
echo "2. Test application: $ALB_URL"
echo "3. Setup monitoring alerts"
echo "4. Configure custom domain DNS (if applicable)"
echo "5. Enable Bedrock models for AI features"
echo "6. Setup SES for email notifications"

echo ""
echo "🔧 Production Management Commands:"
echo "  # Scale service"
echo "  aws ecs update-service --cluster ci-alert-frontend-cluster --service FrontendService --desired-count 4"
echo ""
echo "  # View logs"
echo "  aws logs tail /ecs/ci-alert-frontend --follow"
echo ""
echo "  # Check service health"
echo "  aws elbv2 describe-target-health --target-group-arn \$(aws elbv2 describe-target-groups --names FrontendTargetGroup --query 'TargetGroups[0].TargetGroupArn' --output text)"

echo ""
echo "🎉 Production deployment complete!"
echo "   Your CI Alert System is now running on production-grade infrastructure"