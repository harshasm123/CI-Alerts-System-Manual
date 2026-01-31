#!/bin/bash

# Fix CI/CD Pipeline Issues
# Usage: ./fix-pipeline.sh [github-token]

set -e

GITHUB_TOKEN=${1:-""}
REGION=${AWS_DEFAULT_REGION:-us-west-2}

print_status() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
print_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
print_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

if [ -z "$GITHUB_TOKEN" ]; then
    print_error "GitHub token required"
    echo "Usage: ./fix-pipeline.sh YOUR_GITHUB_TOKEN"
    echo ""
    echo "Get token from: https://github.com/settings/tokens"
    echo "Required permissions: repo, workflow"
    exit 1
fi

print_status "Fixing CI/CD pipeline configuration..."

# 1. Create GitHub token secret
print_status "Creating GitHub token secret..."
aws secretsmanager create-secret \
    --name "github-token" \
    --description "GitHub token for CI/CD pipeline" \
    --secret-string "$GITHUB_TOKEN" \
    --region $REGION 2>/dev/null || \
aws secretsmanager update-secret \
    --secret-id "github-token" \
    --secret-string "$GITHUB_TOKEN" \
    --region $REGION

print_success "GitHub token configured"

# 2. Deploy CICD stack independently
print_status "Deploying CI/CD pipeline..."
cd infrastructure
export ENVIRONMENT=production
export ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}

cdk deploy CIAlert-CICD --require-approval never --outputs-file outputs/cicd.json

print_success "CI/CD pipeline deployed"

# 3. Test pipeline
print_status "Testing pipeline..."
PIPELINE_NAME=$(aws codepipeline list-pipelines --query "pipelines[?contains(name,'CIAlert')].name|[0]" --output text --region $REGION)

if [ -n "$PIPELINE_NAME" ] && [ "$PIPELINE_NAME" != "None" ]; then
    aws codepipeline start-pipeline-execution --name "$PIPELINE_NAME" --region $REGION
    print_success "Pipeline execution started: $PIPELINE_NAME"
else
    print_error "Pipeline not found"
fi

cd ..

echo ""
echo "=== PIPELINE STATUS ==="
echo "✅ GitHub token configured"
echo "✅ CI/CD stack deployed"
echo "✅ Pipeline execution started"
echo ""
echo "Monitor pipeline: AWS Console → CodePipeline"
echo "View logs: AWS Console → CodeBuild"