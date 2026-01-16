#!/bin/bash

# Add Sample Insights Data
set -e

echo "📊 Adding Sample Insights Data"
echo "=============================="

REGION=$(aws configure get region || echo "us-west-2")

# Get table name
INSIGHTS_TABLE=$(aws dynamodb list-tables --region $REGION --query "TableNames[?contains(@,'InsightsTable')]|[0]" --output text)

if [ -z "$INSIGHTS_TABLE" ] || [ "$INSIGHTS_TABLE" = "None" ]; then
    echo "❌ InsightsTable not found"
    exit 1
fi

echo "✓ Found table: $INSIGHTS_TABLE"
echo ""

# Sample pharmaceutical molecules and insights
MOLECULES=("pembrolizumab" "nivolumab" "atezolizumab" "durvalumab" "avelumab")
SOURCES=("PubMed" "ClinicalTrials.gov" "FDA" "EMA" "Nature Medicine")

echo "Adding sample insights..."

for i in {1..10}; do
    MOLECULE=${MOLECULES[$((RANDOM % ${#MOLECULES[@]}))]}
    SOURCE=${SOURCES[$((RANDOM % ${#SOURCES[@]}))]}
    TIMESTAMP=$(date -u -d "-$i days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-${i}d +"%Y-%m-%dT%H:%M:%SZ")
    
    INSIGHT_TEXT="Recent clinical trial data shows promising results for $MOLECULE in treating advanced melanoma. Phase III trials demonstrate improved overall survival rates compared to standard chemotherapy. Researchers observed a 45% response rate with manageable side effects. This represents a significant advancement in immunotherapy approaches for cancer treatment."
    
    aws dynamodb put-item \
        --table-name $INSIGHTS_TABLE \
        --region $REGION \
        --item "{
            \"molecule\": {\"S\": \"$MOLECULE\"},
            \"timestamp\": {\"S\": \"$TIMESTAMP\"},
            \"GSI1PK\": {\"S\": \"$MOLECULE\"},
            \"GSI1SK\": {\"S\": \"$TIMESTAMP\"},
            \"insights\": {\"S\": \"$INSIGHT_TEXT\"},
            \"summary\": {\"S\": \"$INSIGHT_TEXT\"},
            \"source\": {\"S\": \"$SOURCE\"},
            \"impact_score\": {\"N\": \"$((RANDOM % 10 + 1))\"},
            \"insight_id\": {\"S\": \"insight-$RANDOM-$i\"}
        }" \
        --no-cli-pager > /dev/null
    
    echo "  ✓ Added insight $i: $MOLECULE from $SOURCE"
done

echo ""
echo "✅ Sample data added successfully!"
echo ""
echo "🔍 Verifying data..."
COUNT=$(aws dynamodb scan --table-name $INSIGHTS_TABLE --region $REGION --select COUNT --query 'Count' --output text)
echo "  Total insights in table: $COUNT"
echo ""
echo "📱 Refresh your frontend to see the insights!"
