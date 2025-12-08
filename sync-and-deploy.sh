#!/bin/bash
set -e

echo "🔄 Syncing Frontend and Backend Configuration..."

# Get backend outputs
echo "📋 Fetching backend configuration..."
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region us-west-2 --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region us-west-2 --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region us-west-2 --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
REGION="us-west-2"

echo "✅ Backend Configuration:"
echo "   API URL: $API_URL"
echo "   User Pool: $USER_POOL_ID"
echo "   Client ID: $CLIENT_ID"
echo "   Region: $REGION"

# Update frontend config.js
echo ""
echo "📝 Updating frontend/public/config.js..."
cat > frontend/public/config.js <<EOF
window.APP_CONFIG = {
  API_URL: '$API_URL',
  USER_POOL_ID: '$USER_POOL_ID',
  USER_POOL_CLIENT_ID: '$CLIENT_ID',
  REGION: '$REGION'
};
EOF

echo "✅ Config file updated"
cat frontend/public/config.js

# Clean Docker cache
echo ""
echo "🧹 Cleaning Docker cache..."
rm -rf infrastructure/cdk.out
docker rmi $(docker images -q 'cdkasset-*') 2>/dev/null || true

# Deploy frontend with correct context
echo ""
echo "🚀 Deploying frontend..."
cd infrastructure
npx cdk deploy CIAlert-Frontend \
  --context apiUrl=$API_URL \
  --context userPoolId=$USER_POOL_ID \
  --context userPoolClientId=$CLIENT_ID \
  --context region=$REGION \
  --require-approval never \
  --force

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your application:"
ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region us-west-2 --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' --output text)
echo "   $ALB_URL"
