#!/bin/bash

# CI Alert System Test Script
set -e

echo "🧪 Testing CI Alert System"

REGION=$(aws configure get region)
STACK_NAME="CIAlertStack"

# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

echo "📍 API URL: $API_URL"

# Test 1: Get insights
echo ""
echo "Test 1: Get insights"
curl -s "${API_URL}insights" | jq '.'

# Test 2: Add molecule to watchlist
echo ""
echo "Test 2: Add Keytruda to watchlist"
curl -s -X POST "${API_URL}watchlist" \
  -H "Content-Type: application/json" \
  -d '{"molecule":"Keytruda"}' | jq '.'

# Test 3: Get watchlist
echo ""
echo "Test 3: Get watchlist"
curl -s "${API_URL}watchlist" | jq '.'

# Test 4: Trigger PubMed ingestion
echo ""
echo "Test 4: Trigger PubMed ingestion"
aws lambda invoke \
  --function-name ${STACK_NAME}-PubMedFunction* \
  --region $REGION \
  --log-type Tail \
  response.json

cat response.json | jq '.'

# Test 5: Check DynamoDB tables
echo ""
echo "Test 5: Check DynamoDB tables"
aws dynamodb list-tables --region $REGION | grep -i "cialert"

echo ""
echo "✅ All tests complete!"
