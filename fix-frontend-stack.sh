#!/bin/bash

# Fix Frontend Stack - Remove CloudFront, Use S3 Only
set -e

#!/bin/bash
set -e

echo "🔧 Quick Update - Lambda Functions Only"
echo "========================================"

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

echo "📋 Region: $REGION"
echo ""
echo "This script quickly updates Lambda functions without full redeployment."
echo ""

# Build infrastructure
echo "🏗️  Building TypeScript..."
cd infrastructure
npm run build

# Deploy just the main stack (Lambda functions)
echo ""
echo "📦 Deploying Lambda function updates..."
cdk deploy CIAlertStack --require-approval never
cd ..

echo ""
echo "✅ Lambda functions updated!"
echo ""
echo "📝 Changes deployed:"
echo "  - Fixed user_settings_api.py (userId key)"
echo "  - Fixed agent_api.py (sessionId handling)"
echo "  - Added /agent endpoint to API Gateway"
echo ""
echo "🔄 Now redeploy frontend to get latest changes:"
echo "   bash 'shell scripts/deploy-cognito-frontend.sh'"
echo ""
echo "✅ Done!"
