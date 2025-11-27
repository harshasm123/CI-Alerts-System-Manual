#!/bin/bash

# CI Alert System - Unified Test Script

echo "🧪 CI Alert System Test Suite"
echo "=============================="
echo ""

# Get stack outputs
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null)

# Parse command line arguments
case "$1" in
  cognito)
    echo "🔐 Testing Cognito Configuration..."
    echo "User Pool ID: $USER_POOL_ID"
    echo "Client ID: $USER_POOL_CLIENT_ID"
    echo ""
    echo "📋 User Pool Client Configuration:"
    aws cognito-idp describe-user-pool-client \
      --user-pool-id $USER_POOL_ID \
      --client-id $USER_POOL_CLIENT_ID \
      --query 'UserPoolClient.{ClientId:ClientId,ExplicitAuthFlows:ExplicitAuthFlows}' \
      --output json
    echo ""
    echo "👥 Existing Users:"
    aws cognito-idp list-users --user-pool-id $USER_POOL_ID --query 'Users[].{Username:Username,Status:UserStatus,Email:Attributes[?Name==`email`].Value|[0]}' --output table
    ;;
    
  system)
    echo "📊 Testing Full System..."
    echo "API URL: $API_URL"
    echo ""
    
    # Check DynamoDB tables
    echo "📊 Checking DynamoDB Tables..."
    INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text)
    WATCHLIST_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Watchlist')]|[0]" --output text)
    echo "Insights Table: $INSIGHTS_TABLE"
    echo "Watchlist Table: $WATCHLIST_TABLE"
    aws dynamodb scan --table-name $INSIGHTS_TABLE --max-items 5 --query 'Items[].{Molecule:molecule.S,Timestamp:timestamp.S}' --output table
    echo ""
    
    # Check Lambda functions
    echo "🔍 Lambda Functions:"
    PUBMED_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'PubMed')].FunctionName|[0]" --output text)
    PROCESSOR_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'Processor')].FunctionName|[0]" --output text)
    echo "PubMed: $PUBMED_FUNCTION"
    echo "Processor: $PROCESSOR_FUNCTION"
    ;;
    
  digest)
    echo "📧 Testing Daily Digest..."
    DIGEST_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'Digest')].FunctionName|[0]" --output text)
    if [ -z "$DIGEST_FUNCTION" ]; then
      echo "❌ Digest function not found"
      exit 1
    fi
    echo "Function: $DIGEST_FUNCTION"
    echo ""
    echo "🚀 Triggering digest..."
    aws lambda invoke --function-name $DIGEST_FUNCTION --cli-binary-format raw-in-base64-out response.json
    cat response.json
    echo ""
    echo "📋 Recent logs:"
    aws logs tail /aws/lambda/$DIGEST_FUNCTION --since 2m --format short
    ;;
    
  ingestion)
    echo "🚀 Triggering PubMed Ingestion..."
    PUBMED_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'PubMed')].FunctionName|[0]" --output text)
    echo "Function: $PUBMED_FUNCTION"
    echo ""
    echo "📥 Ingesting Keytruda..."
    aws lambda invoke --function-name $PUBMED_FUNCTION --payload '{"molecule":"Keytruda"}' --cli-binary-format raw-in-base64-out response1.json
    cat response1.json
    echo ""
    echo "📥 Ingesting Opdivo..."
    aws lambda invoke --function-name $PUBMED_FUNCTION --payload '{"molecule":"Opdivo"}' --cli-binary-format raw-in-base64-out response2.json
    cat response2.json
    echo ""
    echo "⏳ Waiting 15 seconds for processing..."
    sleep 15
    echo "📊 Checking insights..."
    INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text)
    aws dynamodb scan --table-name $INSIGHTS_TABLE --max-items 10 --query 'Items[].{Molecule:molecule.S,Timestamp:timestamp.S}' --output table
    ;;
    
  api)
    echo "🌐 Testing API Endpoints..."
    echo "API URL: $API_URL"
    echo ""
    echo "GET /insights:"
    curl -s "${API_URL}insights" | jq '.' || curl -s "${API_URL}insights"
    echo ""
    ;;
    
  *)
    echo "Usage: bash test.sh [cognito|system|digest|ingestion|api]"
    echo ""
    echo "Options:"
    echo "  cognito    - Test Cognito configuration and users"
    echo "  system     - Test full system (DynamoDB, Lambda)"
    echo "  digest     - Test daily digest email"
    echo "  ingestion  - Trigger PubMed ingestion"
    echo "  api        - Test API endpoints"
    echo ""
    echo "Examples:"
    echo "  bash test.sh cognito"
    echo "  bash test.sh system"
    echo "  bash test.sh digest"
    exit 1
    ;;
esac

echo ""
echo "✅ Test complete!"
