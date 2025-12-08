#!/bin/bash

# Add a test user to Cognito User Pool
# Usage: ./add-cognito-user.sh <email> <password>

set -e

if [ $# -lt 2 ]; then
    echo "Usage: ./add-cognito-user.sh <email> <password>"
    echo "Example: ./add-cognito-user.sh test@example.com MyPassword123!"
    exit 1
fi

EMAIL=$1
PASSWORD=$2
REGION=${AWS_REGION:-us-west-2}

# Get User Pool ID from CloudFormation outputs
echo "📋 Fetching User Pool ID from CloudFormation..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name CIAlertStack \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$USER_POOL_ID" ]; then
    echo "❌ Could not find User Pool ID. Make sure CIAlertStack is deployed."
    exit 1
fi

echo "✅ User Pool ID: $USER_POOL_ID"
echo ""

# Create user
echo "👤 Creating user: $EMAIL"
aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS \
    --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ User created successfully"
else
    echo "⚠️  User may already exist, attempting to set password..."
fi

echo ""
echo "🔐 Setting permanent password..."
aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --password "$PASSWORD" \
    --permanent \
    --region $REGION

echo "✅ Password set successfully"
echo ""
echo "✨ User account ready!"
echo "   Email: $EMAIL"
echo "   Password: $PASSWORD"
echo ""
echo "You can now sign in at the application URL."
