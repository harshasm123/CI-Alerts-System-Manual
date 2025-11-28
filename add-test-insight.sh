#!/bin/bash
set -e

echo "➕ Adding Test Insight..."
echo ""

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

# Get insights table name
TABLE_NAME=$(aws dynamodb list-tables --region $REGION --query "TableNames[?contains(@, 'InsightsTable')]" --output text)

if [ -z "$TABLE_NAME" ]; then
    echo "❌ Insights table not found"
    exit 1
fi

echo "📋 Table: $TABLE_NAME"
echo ""

# Add a test insight
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
MOLECULE="Keytruda"

echo "Adding test insight for $MOLECULE..."

aws dynamodb put-item \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --item '{
        "molecule": {"S": "'"$MOLECULE"'"},
        "timestamp": {"S": "'"$TIMESTAMP"'"},
        "insights": {"S": "Test insight: Keytruda shows promising results in recent clinical trials. This is a manually added test insight to verify the system is working."},
        "source": {"S": "Manual Test"},
        "raw_content": {"S": "This is a test insight added manually to verify the insights display functionality."}
    }'

echo ""
echo "✅ Test insight added!"
echo ""
echo "📝 Now refresh your Insights page in the UI"
echo "   You should see the test insight for $MOLECULE"
