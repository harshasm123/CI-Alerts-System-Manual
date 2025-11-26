#!/bin/bash

# Trigger manual ingestion for testing
echo "🔍 Triggering manual ingestion..."

# Get DynamoDB table name
INSIGHTS_TABLE=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`InsightsTableName`].OutputValue' --output text)

if [ -z "$INSIGHTS_TABLE" ]; then
    echo "❌ Insights table not found"
    exit 1
fi

echo "📝 Creating sample insights in $INSIGHTS_TABLE..."

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Sample insight 1
aws dynamodb put-item --table-name "$INSIGHTS_TABLE" --item '{
    "insight_id": {"S": "sample-001"},
    "molecule": {"S": "pembrolizumab"},
    "timestamp": {"S": "'$TIMESTAMP'"},
    "summary": {"S": "FDA approves pembrolizumab for new indication in triple-negative breast cancer. Phase III trial showed 42% improvement in progression-free survival."},
    "source": {"S": "FDA"},
    "impact_level": {"S": "HIGH"},
    "relevance_score": {"N": "0.95"}
}'

# Sample insight 2
aws dynamodb put-item --table-name "$INSIGHTS_TABLE" --item '{
    "insight_id": {"S": "sample-002"},
    "molecule": {"S": "pembrolizumab"},
    "timestamp": {"S": "'$TIMESTAMP'"},
    "summary": {"S": "New clinical trial initiated combining pembrolizumab with novel CAR-T therapy. Study aims to enroll 200 patients across 15 sites."},
    "source": {"S": "ClinicalTrials.gov"},
    "impact_level": {"S": "MEDIUM"},
    "relevance_score": {"N": "0.78"}
}'

# Sample insight 3
aws dynamodb put-item --table-name "$INSIGHTS_TABLE" --item '{
    "insight_id": {"S": "sample-003"},
    "molecule": {"S": "nivolumab"},
    "timestamp": {"S": "'$TIMESTAMP'"},
    "summary": {"S": "EMA recommends approval for nivolumab in combination therapy for advanced melanoma. Expected market authorization in Q2 2024."},
    "source": {"S": "EMA"},
    "impact_level": {"S": "HIGH"},
    "relevance_score": {"N": "0.89"}
}'

echo "✅ Sample insights created!"
echo "🔄 Refresh your browser to see insights"
