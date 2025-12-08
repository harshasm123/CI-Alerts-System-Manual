#!/bin/bash
set -e

echo "🧹 Cleaning all caches..."
rm -rf infrastructure/cdk.out
docker rmi $(docker images -q 'cdkasset-*') 2>/dev/null || true
docker system prune -f

echo "📋 Getting Cognito Client ID..."
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text --region us-west-2)

echo "🔨 Building Docker image locally to verify..."
cd frontend
docker build \
  --no-cache \
  --build-arg REACT_APP_API_URL=https://ndqszfo7nj.execute-api.us-west-2.amazonaws.com/prod/ \
  --build-arg REACT_APP_USER_POOL_ID=us-west-2_qm5TpguBr \
  --build-arg REACT_APP_USER_POOL_CLIENT_ID=$CLIENT_ID \
  --build-arg REACT_APP_REGION=us-west-2 \
  -t ci-alert-frontend-test .

echo "✅ Local build complete. Testing..."
docker run -d -p 8080:8080 --name test-frontend ci-alert-frontend-test
sleep 5

echo "🧪 Checking if env vars are in bundle..."
curl -s http://localhost:8080/static/js/main.*.js 2>/dev/null | grep -o "ndqszfo7nj" && echo "✅ API URL found in bundle!" || echo "❌ API URL NOT in bundle"

docker stop test-frontend && docker rm test-frontend

echo ""
echo "🚀 Now deploying to AWS..."
cd ../infrastructure
npx cdk deploy CIAlert-Frontend \
  --context apiUrl=https://ndqszfo7nj.execute-api.us-west-2.amazonaws.com/prod/ \
  --context userPoolId=us-west-2_qm5TpguBr \
  --context userPoolClientId=$CLIENT_ID \
  --context region=us-west-2 \
  --require-approval never \
  --force

echo "✅ Deployment complete!"
