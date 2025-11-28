#!/bin/bash
set -e

echo "🚀 Deploying Cognito-Integrated Frontend..."

# Get stack outputs
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
REGION=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`Region`].OutputValue' --output text)
BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)
WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' --output text 2>/dev/null || echo "")

echo "✅ API URL: $API_URL"
echo "✅ User Pool: $USER_POOL_ID"
echo "✅ Region: $REGION"
echo "✅ S3 Bucket: $BUCKET"

# Determine project root (handle both direct execution and from shell scripts dir)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$SCRIPT_DIR/../frontend" ]; then
    # Script is in a subdirectory (shell scripts/)
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [ -d "$SCRIPT_DIR/frontend" ]; then
    # Script is in project root
    PROJECT_ROOT="$SCRIPT_DIR"
else
    echo "❌ Error: Cannot find frontend directory"
    echo "   Looked in: $SCRIPT_DIR/frontend and $SCRIPT_DIR/../frontend"
    echo "   Current directory: $(pwd)"
    echo "   Script directory: $SCRIPT_DIR"
    exit 1
fi

echo "📁 Project root: $PROJECT_ROOT"

# Check if frontend directory exists
if [ ! -d "$PROJECT_ROOT/frontend" ]; then
    echo "❌ Error: Frontend directory not found at $PROJECT_ROOT/frontend"
    exit 1
fi

# Create .env file
cd "$PROJECT_ROOT/frontend"
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

if [ -n "$CLOUDFRONT" ]; then
  echo "🔄 Invalidating CloudFront cache..."
  aws cloudfront create-invalidation --distribution-id $CLOUDFRONT --paths "/*"
else
  echo "⚠️  CloudFront distribution ID not found, skipping cache invalidation"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
if [ -n "$WEBSITE_URL" ]; then
  echo "🌐 Frontend URL: $WEBSITE_URL"
else
  echo "🌐 Frontend URL: http://$BUCKET.s3-website-$REGION.amazonaws.com"
fi
echo ""
echo "📝 To create a test user:"
echo "   aws cognito-idp sign-up --client-id $USER_POOL_CLIENT_ID --username test@example.com --password Test123!"
echo ""
echo "📝 To confirm user (if auto-verify fails):"
echo "   aws cognito-idp admin-confirm-user --user-pool-id $USER_POOL_ID --username test@example.com"
echo ""
echo "🔗 Open your browser to: $WEBSITE_URL"
