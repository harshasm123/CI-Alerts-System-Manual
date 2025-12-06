#!/bin/bash

# Fix Lambda dependencies by creating deployment package
set -e

echo "🔧 Fixing Lambda dependencies..."

# Create temp directory
mkdir -p /tmp/lambda-package
cd /tmp/lambda-package

# Copy Lambda code
cp ~/CI-Alerts-System-Manual/lambdas/ingestion/pubmed_ingestion.py .

# Install dependencies
pip3 install requests boto3 -t .

# Create deployment package
zip -r pubmed-function.zip .

# Update Lambda function
FUNCTION_NAME="CIAlertStack-PubMedFunctionE2C7A61F-uv3PA1uaU7et"
REGION="us-east-2"

echo "📦 Updating Lambda function: $FUNCTION_NAME"

aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://pubmed-function.zip \
    --region $REGION

echo "⏳ Waiting for update to complete..."
aws lambda wait function-updated \
    --function-name $FUNCTION_NAME \
    --region $REGION

echo "✅ Lambda function updated with dependencies!"

# Cleanup
cd ~
rm -rf /tmp/lambda-package

echo "🧪 Test the function:"
echo "aws lambda invoke --function-name $FUNCTION_NAME --region $REGION response.json"