#!/bin/bash

set -e

echo "🚀 Deploying Frontend to CloudFront"

# Get stack outputs
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
CONFIG=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`ConfigInfo`].OutputValue' --output text)

echo "📦 Building frontend..."
cd frontend

# Create .env file
echo "$CONFIG" | jq -r 'to_entries | .[] | "REACT_APP_\(.key | ascii_upcase)=\(.value)"' > .env

# Build
npm install
npm run build

echo "📤 Uploading to S3..."
aws s3 sync build/ s3://$BUCKET_NAME/ --delete

echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo "✅ Deployment complete!"
echo "🌐 URL: https://$(aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.DomainName' --output text)"
