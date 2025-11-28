#!/bin/bash
set -e

echo "🔍 Checking Ingestion Status..."
echo ""

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

# Check PubMed function logs
echo "📋 Checking PubMed Ingestion Logs..."
PUBMED_FUNCTION=$(aws lambda list-functions --region $REGION --query "Functions[?contains(FunctionName, 'PubMedFunction')].FunctionName" --output text)

if [ -n "$PUBMED_FUNCTION" ]; then
    echo "Function: $PUBMED_FUNCTION"
    echo ""
    echo "Recent logs:"
    aws logs tail "/aws/lambda/$PUBMED_FUNCTION" --region $REGION --since 30m --format short 2>/dev/null || echo "No recent logs found"
else
    echo "❌ PubMed function not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Processor function logs
echo "📋 Checking Processor Logs..."
PROCESSOR_FUNCTION=$(aws lambda list-functions --region $REGION --query "Functions[?contains(FunctionName, 'ProcessorFunction')].FunctionName" --output text)

if [ -n "$PROCESSOR_FUNCTION" ]; then
    echo "Function: $PROCESSOR_FUNCTION"
    echo ""
    echo "Recent logs:"
    aws logs tail "/aws/lambda/$PROCESSOR_FUNCTION" --region $REGION --since 30m --format short 2>/dev/null || echo "No recent logs found"
else
    echo "❌ Processor function not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check SQS queue
echo "📋 Checking SQS Queue..."
QUEUE_URL=$(aws sqs list-queues --region $REGION --query "QueueUrls[?contains(@, 'EventQueue')]" --output text)

if [ -n "$QUEUE_URL" ]; then
    echo "Queue: $QUEUE_URL"
    echo ""
    ATTRS=$(aws sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names All --region $REGION --query 'Attributes' --output json)
    echo "Messages Available: $(echo $ATTRS | jq -r '.ApproximateNumberOfMessages')"
    echo "Messages In Flight: $(echo $ATTRS | jq -r '.ApproximateNumberOfMessagesNotVisible')"
    echo "Messages Delayed: $(echo $ATTRS | jq -r '.ApproximateNumberOfMessagesDelayed')"
else
    echo "❌ SQS queue not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check DynamoDB insights table
echo "📋 Checking DynamoDB Insights..."
TABLE_NAME=$(aws dynamodb list-tables --region $REGION --query "TableNames[?contains(@, 'InsightsTable')]" --output text)

if [ -n "$TABLE_NAME" ]; then
    echo "Table: $TABLE_NAME"
    echo ""
    ITEM_COUNT=$(aws dynamodb scan --table-name "$TABLE_NAME" --select COUNT --region $REGION --query 'Count' --output text)
    echo "Total Insights: $ITEM_COUNT"
    
    if [ "$ITEM_COUNT" -gt 0 ]; then
        echo ""
        echo "Recent insights:"
        aws dynamodb scan --table-name "$TABLE_NAME" --limit 3 --region $REGION --query 'Items[*].[molecule.S, timestamp.S]' --output table
    fi
else
    echo "❌ Insights table not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Bedrock model access
echo "📋 Checking Bedrock Model Access..."
NOVA_LITE_STATUS=$(aws bedrock list-foundation-models --region $REGION --query "modelSummaries[?modelId=='us.amazon.nova-lite-v1:0'].modelId" --output text 2>/dev/null || echo "")

if [ -n "$NOVA_LITE_STATUS" ]; then
    echo "✅ Amazon Nova Lite model is available"
else
    echo "⚠️  Amazon Nova Lite model not accessible"
    echo "   You may need to enable Bedrock model access:"
    echo "   AWS Console → Bedrock → Model Access → Enable Amazon Nova Lite"
fi

echo ""
echo "✅ Status check complete!"
