#!/bin/bash

echo "🚀 CI Alert System - Amplify Deployment"
echo "========================================"
echo ""

# Check if core stack is deployed
echo "📋 Checking core stack deployment..."
CORE_STACK_STATUS=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region us-west-2 --query 'Stacks[0].StackStatus' --output text 2>/dev/null)

if [ "$CORE_STACK_STATUS" != "CREATE_COMPLETE" ] && [ "$CORE_STACK_STATUS" != "UPDATE_COMPLETE" ]; then
    echo "❌ Core stack not found or not deployed. Please deploy CIAlertStack first:"
    echo "   npx cdk deploy CIAlertStack --require-approval never"
    exit 1
fi

echo "✅ Core stack is deployed"
echo ""

# Prompt for GitHub token
echo "🔑 GitHub Personal Access Token Required"
echo "----------------------------------------"
echo "To deploy Amplify, you need a GitHub Personal Access Token with 'repo' and 'admin:repo_hook' permissions."
echo ""
echo "Create one at: https://github.com/settings/tokens"
echo "Required scopes: repo, admin:repo_hook"
echo ""
read -s -p "Enter your GitHub Personal Access Token (ghp_...): " GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ No token provided. Exiting."
    exit 1
fi

if [[ ! "$GITHUB_TOKEN" =~ ^ghp_ ]]; then
    echo "⚠️  Warning: Token doesn't start with 'ghp_'. Are you sure this is correct? (y/N)"
    read -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled."
        exit 1
    fi
fi

# Update the secret
echo "🔐 Updating GitHub token in AWS Secrets Manager..."
aws secretsmanager update-secret \
    --secret-id "github-token" \
    --secret-string "$GITHUB_TOKEN" \
    --region us-west-2 > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ GitHub token updated successfully"
else
    echo "❌ Failed to update GitHub token. Creating new secret..."
    aws secretsmanager create-secret \
        --name "github-token" \
        --description "GitHub Personal Access Token for Amplify" \
        --secret-string "$GITHUB_TOKEN" \
        --region us-west-2 > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ GitHub token secret created successfully"
    else
        echo "❌ Failed to create GitHub token secret. Exiting."
        exit 1
    fi
fi

echo ""

# Clean up any failed Amplify stack
echo "🧹 Cleaning up any existing failed Amplify stack..."
aws cloudformation delete-stack --stack-name CIAlert-Amplify --region us-west-2 2>/dev/null
echo "⏳ Waiting for cleanup to complete..."
aws cloudformation wait stack-delete-complete --stack-name CIAlert-Amplify --region us-west-2 2>/dev/null

echo ""

# Deploy Amplify stack
echo "🚀 Deploying Amplify stack..."
cd infrastructure
npx cdk deploy CIAlert-Amplify --require-approval never

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Amplify deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to AWS Amplify Console"
    echo "2. Your app should be connected to GitHub repository"
    echo "3. Amplify will automatically build and deploy your React app"
    echo ""
    echo "🔗 Useful links:"
    echo "   - Amplify Console: https://console.aws.amazon.com/amplify/home?region=us-west-2"
    echo "   - API Gateway: https://fhyzctqyw9.execute-api.us-west-2.amazonaws.com/prod/"
    echo "   - Cognito User Pool: us-west-2_DPN4mpJMi"
else
    echo ""
    echo "❌ Amplify deployment failed!"
    echo "Please check the error messages above and try again."
    exit 1
fi