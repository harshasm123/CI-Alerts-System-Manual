#!/bin/bash

echo "🔍 Testing Cognito Configuration..."

# Get stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $USER_POOL_CLIENT_ID"
echo ""

# Check user pool client settings
echo "📋 User Pool Client Configuration:"
aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $USER_POOL_CLIENT_ID \
  --query 'UserPoolClient.{ClientId:ClientId,ExplicitAuthFlows:ExplicitAuthFlows}' \
  --output json

echo ""
echo "👥 Existing Users:"
aws cognito-idp list-users --user-pool-id $USER_POOL_ID --query 'Users[].{Username:Username,Status:UserStatus,Email:Attributes[?Name==`email`].Value|[0]}' --output table

echo ""
echo "📝 To create and confirm a test user:"
echo "aws cognito-idp sign-up --client-id $USER_POOL_CLIENT_ID --username test@example.com --password Test123! --user-attributes Name=email,Value=test@example.com"
echo "aws cognito-idp admin-confirm-user --user-pool-id $USER_POOL_ID --username test@example.com"
