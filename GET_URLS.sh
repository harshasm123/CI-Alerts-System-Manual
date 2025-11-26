#!/bin/bash

# Script to get all deployed URLs and endpoints

echo "🔍 Fetching deployed resources..."
echo ""

REGION=$(aws configure get region || echo "us-east-1")

echo "🌍 Region: $REGION"
echo ""

# Get Stack Outputs
echo "📋 Stack Outputs:"
API_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null)
DATA_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text 2>/dev/null)

if [ -n "$API_URL" ]; then
    echo "  🌐 API Gateway: $API_URL"
fi
if [ -n "$USER_POOL_ID" ]; then
    echo "  🔐 User Pool ID: $USER_POOL_ID"
fi
if [ -n "$USER_POOL_CLIENT_ID" ]; then
    echo "  🔑 Client ID: $USER_POOL_CLIENT_ID"
fi
if [ -n "$DATA_BUCKET" ]; then
    echo "  🪣 S3 Bucket: s3://$DATA_BUCKET"
fi

echo ""
echo "📊 DynamoDB Tables:"
for table in $(aws dynamodb list-tables --region $REGION --query 'TableNames[?contains(@, `CIAlertStack`)]' --output text); do
    echo "  ✓ $table"
done

echo ""
echo "⚡ Lambda Functions:"
for func in $(aws lambda list-functions --region $REGION --query 'Functions[?contains(FunctionName, `CIAlertStack`)].FunctionName' --output text); do
    echo "  ✓ $func"
done

echo ""
echo "🧪 Test Commands:"
if [ -n "$API_URL" ]; then
    echo "  # Get insights"
    echo "  curl ${API_URL}insights"
    echo ""
    echo "  # Add to watchlist"
    echo "  curl -X POST ${API_URL}watchlist -H 'Content-Type: application/json' -d '{\"userId\":\"test\",\"molecule\":\"Keytruda\"}'"
    echo ""
    echo "  # Trigger PubMed ingestion"
    echo "  aws lambda invoke --function-name \$(aws lambda list-functions --query 'Functions[?contains(FunctionName, \`PubMed\`)].FunctionName' --output text) --region $REGION response.json"
fi