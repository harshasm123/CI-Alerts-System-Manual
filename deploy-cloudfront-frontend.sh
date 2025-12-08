#!/bin/bash

# CloudFront Production Frontend Deployment Script
# Deploys React app with CloudFront for global distribution

set -e

echo "🚀 Deploying CI Alert Frontend with CloudFront"

# Check if domain provided
DOMAIN=$1
CERT_ARN=$2
CF_CERT_ARN=$3

if [ -z "$DOMAIN" ]; then
    echo "📍 No domain provided. Using CloudFront URL."
    DOMAIN_CONFIG=""
else
    echo "📍 Domain: $DOMAIN"
    if [ -z "$CERT_ARN" ] || [ -z "$CF_CERT_ARN" ]; then
        echo "❌ Error: Certificate ARNs required for custom domain"
        echo ""
        echo "Usage:"
        echo "  bash deploy-cloudfront-frontend.sh yourdomain.com cert-arn cf-cert-arn"
        echo ""
        echo "Get certificate ARNs:"
        echo "  aws acm list-certificates --query 'CertificateSummaryList[*].[CertificateArn,DomainName]' --output text"
        exit 1
    fi
    DOMAIN_CONFIG="export DOMAIN_NAME=$DOMAIN; export CERT_ARN=$CERT_ARN; export CF_CERT_ARN=$CF_CERT_ARN"
fi

# Navigate to infrastructure
cd infrastructure

echo "📦 Installing dependencies..."
npm install

echo "🔍 Getting API configuration..."
API_STACK_NAME="CIAlertStack"
USER_POOL_STACK_NAME="CIAlertStack"

# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$API_STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text 2>/dev/null || echo "https://api.example.com")

# Get Cognito config
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$USER_POOL_STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text 2>/dev/null || echo "us-east-1_XXXXXXXXX")

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$USER_POOL_STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text 2>/dev/null || echo "xxxxxxxxxxxxxxxxxx")

echo "✓ API URL: $API_URL"
echo "✓ User Pool ID: $USER_POOL_ID"
echo "✓ User Pool Client: $USER_POOL_CLIENT_ID"

# Update cdk.json context
echo "⚙️  Updating configuration..."
cat > cdk.json << EOF
{
  "context": {
    "domainName": "$DOMAIN",
    "certificateArn": "$CERT_ARN",
    "cloudFrontCertificateArn": "$CF_CERT_ARN",
    "apiUrl": "$API_URL",
    "userPoolId": "$USER_POOL_ID",
    "userPoolClientId": "$USER_POOL_CLIENT_ID"
  }
}
EOF

echo ""
echo "🏗️  Building and deploying CloudFront distribution..."
echo "   This may take 10-15 minutes..."
echo ""

cdk deploy CIAlert-Frontend \
  --require-approval never \
  --concurrency 10

echo ""
echo "✅ CloudFront deployment complete!"
echo ""
echo "📊 Deployment Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get outputs
aws cloudformation describe-stacks \
  --stack-name CIAlert-Frontend \
  --query 'Stacks[0].Outputs' \
  --output table

echo ""
echo "🎯 Access your application:"
if [ -n "$DOMAIN" ]; then
    echo "   https://$DOMAIN"
else
    CF_DOMAIN=$(aws cloudformation describe-stacks \
      --stack-name CIAlert-Frontend \
      --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' \
      --output text)
    echo "   https://$CF_DOMAIN"
fi

echo ""
echo "💡 Next steps:"
echo "   1. Test the application: Open URL in browser"
echo "   2. Sign up for a new account"
echo "   3. Configure Cognito as needed"
echo ""
echo "🔍 Monitor performance:"
echo "   aws cloudwatch get-metric-statistics --namespace AWS/CloudFront"
echo ""
echo "🚀 To invalidate cache after code updates:"
echo "   bash scripts/invalidate-cloudfront.sh"
echo ""
