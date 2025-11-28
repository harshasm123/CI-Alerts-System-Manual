#!/bin/bash
set -e

echo "🔄 Triggering data ingestion..."

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

# Get the PubMed function name
FUNCTION_NAME=$(aws lambda list-functions --region $REGION --query "Functions[?contains(FunctionName, 'PubMedFunction')].FunctionName" --output text)

if [ -z "$FUNCTION_NAME" ]; then
    echo "❌ PubMed function not found"
    echo "   Make sure CIAlertStack is deployed"
    exit 1
fi

echo "📋 Function: $FUNCTION_NAME"
echo "📋 Region: $REGION"
echo ""

# Invoke the function
echo "🚀 Invoking ingestion function..."
aws lambda invoke \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --payload '{}' \
    response.json

echo ""
echo "📄 Response:"
cat response.json
echo ""
echo ""

# Clean up
rm -f response.json

echo "✅ Ingestion triggered!"
echo ""
echo "📝 Note: It may take a few minutes for insights to appear in the UI"
echo "   Check the Insights tab after waiting 2-3 minutes"
