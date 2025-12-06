#!/bin/bash

# Setup test user for API testing
set -e

echo "🔐 Setting up test user for API testing..."

# Install jq if missing
if ! command -v jq &> /dev/null; then
    echo "📦 Installing jq..."
    sudo apt-get update
    sudo apt-get install -y jq
fi

# Get stack outputs
REGION="us-east-2"
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)

echo "📋 Configuration:"
echo "  User Pool: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  API URL: $API_URL"

# Create test user
TEST_EMAIL="test@example.com"
TEST_PASSWORD="TempPass123!"

echo "👤 Creating test user: $TEST_EMAIL"

# Create user
aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username $TEST_EMAIL \
    --user-attributes Name=email,Value=$TEST_EMAIL Name=email_verified,Value=true \
    --temporary-password $TEST_PASSWORD \
    --message-action SUPPRESS \
    --region $REGION

# Set permanent password
aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username $TEST_EMAIL \
    --password $TEST_PASSWORD \
    --permanent \
    --region $REGION

echo "✅ Test user created!"
echo ""
echo "🧪 Test API with authentication:"
echo ""
echo "# 1. Get auth token"
echo "TOKEN=\$(aws cognito-idp admin-initiate-auth \\"
echo "    --user-pool-id $USER_POOL_ID \\"
echo "    --client-id $CLIENT_ID \\"
echo "    --auth-flow ADMIN_NO_SRP_AUTH \\"
echo "    --auth-parameters USERNAME=$TEST_EMAIL,PASSWORD=$TEST_PASSWORD \\"
echo "    --region $REGION \\"
echo "    --query 'AuthenticationResult.IdToken' --output text)"
echo ""
echo "# 2. Test API endpoints"
echo "curl -H \"Authorization: Bearer \$TOKEN\" ${API_URL}insights"
echo "curl -X POST -H \"Authorization: Bearer \$TOKEN\" -H \"Content-Type: application/json\" \\"
echo "    -d '{\"userId\":\"$TEST_EMAIL\",\"molecule\":\"Keytruda\"}' ${API_URL}watchlist"
echo ""
echo "📝 Credentials:"
echo "  Email: $TEST_EMAIL"
echo "  Password: $TEST_PASSWORD"