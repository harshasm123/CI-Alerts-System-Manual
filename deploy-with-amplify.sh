#!/bin/bash

echo "🚀 Deploying CI Alert System with Amplify Frontend"
echo "=================================================="
echo ""

echo "📋 Step 1: Create GitHub Personal Access Token"
echo "----------------------------------------------"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Click 'Generate new token (classic)'"
echo "3. Name: 'Amplify CI Alert'"
echo "4. Select scopes: 'repo' and 'admin:repo_hook'"
echo "5. Click 'Generate token'"
echo "6. Copy the token (starts with ghp_)"
echo ""

read -p "Have you created your GitHub token? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please create the token first, then run this script again."
    exit 1
fi

echo ""
echo "📋 Step 2: Update GitHub Token in AWS"
echo "------------------------------------"
echo "Run this command with your actual token:"
echo ""
echo "aws secretsmanager update-secret --secret-id \"github-token\" --secret-string \"YOUR_GITHUB_TOKEN_HERE\" --region us-west-2"
echo ""

read -p "Have you updated the secret with your real token? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please update the secret first, then run this script again."
    exit 1
fi

echo ""
echo "📋 Step 3: Clean up and Deploy"
echo "-----------------------------"

# Clean up failed stack
echo "🧹 Cleaning up any failed Amplify stack..."
aws cloudformation delete-stack --stack-name CIAlert-Amplify --region us-west-2 2>/dev/null
echo "⏳ Waiting for cleanup..."
sleep 10

# Deploy Amplify
echo "🚀 Deploying Amplify stack..."
cd infrastructure
npx cdk deploy CIAlert-Amplify --require-approval never

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Your system is now ready:"
echo "• API Gateway: https://fhyzctqyw9.execute-api.us-west-2.amazonaws.com/prod/"
echo "• Cognito User Pool: us-west-2_DPN4mpJMi"
echo "• Amplify Console: https://console.aws.amazon.com/amplify/home?region=us-west-2"