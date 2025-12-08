#!/bin/bash
set -e

echo "🔄 Rebuilding frontend with Cognito configuration..."

CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text --region us-west-2)

echo "📦 Removing old Docker images..."
docker rmi $(docker images -q cdkasset-*) 2>/dev/null || true
rm -rf infrastructure/cdk.out

echo "🚀 Deploying frontend with build args..."
cd infrastructure
npx cdk deploy CIAlert-Frontend \
  --context apiUrl=https://ekwaqr0pde.execute-api.us-west-2.amazonaws.com/prod/ \
  --context userPoolId=us-west-2_qm5TpguBr \
  --context userPoolClientId=$CLIENT_ID \
  --context region=us-west-2 \
  --require-approval never \
  --force

echo "✅ Frontend rebuilt successfully!"
echo "🌐 URL: http://ci-alert-frontend-alb-530900495.us-west-2.elb.amazonaws.com"
