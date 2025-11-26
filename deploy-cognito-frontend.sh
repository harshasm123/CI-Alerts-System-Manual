#!/bin/bash
set -e

echo "🚀 Deploying Cognito-Integrated Frontend..."

# Get stack outputs
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
REGION=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`Region`].OutputValue' --output text)
BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)
CLOUDFRONT=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)

echo "✅ API URL: $API_URL"
echo "✅ User Pool: $USER_POOL_ID"
echo "✅ Region: $REGION"

# Create .env file
cd frontend
cat > .env << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_REGION=$REGION
EOF

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building React app..."
npm run build

echo "☁️ Uploading to S3..."
aws s3 sync build/ s3://$BUCKET/ --delete

echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT --paths "/*"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Frontend URL: https://$(aws cloudfront get-distribution --id $CLOUDFRONT --query 'Distribution.DomainName' --output text)"
echo ""
echo "📝 To create a test user:"
echo "   aws cognito-idp sign-up --client-id $USER_POOL_CLIENT_ID --username test@example.com --password Test123!"
echo "   aws cognito-idp admin-confirm-user --user-pool-id $USER_POOL_ID --username test@example.com"
