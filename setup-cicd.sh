#!/bin/bash

# CI/CD Setup Script for CI Alert System
# Usage: ./setup-cicd.sh [github-token] [github-owner] [github-repo]

set -e

GITHUB_TOKEN=${1:-""}
GITHUB_OWNER=${2:-"harshasm123"}
GITHUB_REPO=${3:-"CI-Alerts-System-Manual"}
REGION=${AWS_DEFAULT_REGION:-us-west-2}

print_status() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
print_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
print_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

if [ -z "$GITHUB_TOKEN" ]; then
    print_error "GitHub token required"
    echo "Usage: ./setup-cicd.sh YOUR_GITHUB_TOKEN [owner] [repo]"
    echo ""
    echo "Get token from: https://github.com/settings/tokens"
    echo "Required permissions: repo, workflow, admin:repo_hook"
    exit 1
fi

print_status "Setting up CI/CD pipeline..."
print_status "GitHub: $GITHUB_OWNER/$GITHUB_REPO"
print_status "Region: $REGION"

# Check prerequisites
command -v aws >/dev/null 2>&1 || { print_error "AWS CLI required"; exit 1; }
command -v cdk >/dev/null 2>&1 || { print_error "AWS CDK required"; exit 1; }

# Bootstrap CDK if needed
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_status "Bootstrapping CDK for account $ACCOUNT_ID..."
cdk bootstrap aws://$ACCOUNT_ID/$REGION --region $REGION --force

# Deploy core infrastructure first
print_status "Deploying core infrastructure..."
cd infrastructure

export ENVIRONMENT=production
export ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}

# Deploy core stack
cdk deploy CIAlertStack --require-approval never --outputs-file outputs/core.json

# Get core stack outputs
API_URL=$(jq -r '.CIAlertStack.ApiUrl' outputs/core.json 2>/dev/null || echo "")
USER_POOL_ID=$(jq -r '.CIAlertStack.UserPoolId' outputs/core.json 2>/dev/null || echo "")
USER_POOL_CLIENT_ID=$(jq -r '.CIAlertStack.UserPoolClientId' outputs/core.json 2>/dev/null || echo "")

print_success "Core infrastructure deployed"

# Deploy ECS CI/CD stack
print_status "Deploying ECS CI/CD pipeline..."

export GITHUB_TOKEN=$GITHUB_TOKEN
export GITHUB_OWNER=$GITHUB_OWNER
export GITHUB_REPO=$GITHUB_REPO
export API_URL=$API_URL
export USER_POOL_ID=$USER_POOL_ID
export USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID

cdk deploy CIAlert-ECS-CICD --require-approval never --outputs-file outputs/ecs-cicd.json

# Get ECS outputs
ALB_URL=$(jq -r '."CIAlert-ECS-CICD".LoadBalancerURL' outputs/ecs-cicd.json 2>/dev/null || echo "")
ECR_URI=$(jq -r '."CIAlert-ECS-CICD".ECRRepositoryURI' outputs/ecs-cicd.json 2>/dev/null || echo "")

cd ..

print_success "🎉 CI/CD Pipeline deployed successfully!"

echo ""
echo "=== DEPLOYMENT SUMMARY ==="
echo "Core API: $API_URL"
echo "Frontend: $ALB_URL"
echo "ECR Repository: $ECR_URI"
echo ""
echo "=== CI/CD PIPELINE ==="
echo "✅ GitHub webhook configured"
echo "✅ CodeBuild project created"
echo "✅ CodePipeline deployed"
echo "✅ ECS Fargate service running"
echo "✅ Application Load Balancer configured"
echo ""
echo "=== NEXT STEPS ==="
echo "1. Push code to main branch to trigger build"
echo "2. Monitor pipeline: AWS Console → CodePipeline"
echo "3. View logs: AWS Console → CodeBuild"
echo "4. Access app: $ALB_URL"
echo ""
echo "=== PIPELINE FLOW ==="
echo "GitHub Push → CodeBuild → Docker Build → ECR Push → ECS Deploy"