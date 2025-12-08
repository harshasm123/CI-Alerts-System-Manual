#!/bin/bash

# Invalidate CloudFront Cache
# Run this after deploying frontend code changes

set -e

echo "🔄 Invalidating CloudFront cache..."

# Get distribution ID from CloudFormation
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name CIAlert-Frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' \
  --output text | grep -oP '(?<=^d)\w+(?=\.cloudfront\.net$)' || \
  aws cloudfront list-distributions \
  --query 'DistributionList.Items[?Comment==`CI Alert Frontend CloudFront OAI`].Id' \
  --output text | head -1)

if [ -z "$DIST_ID" ]; then
    echo "❌ Error: Could not find CloudFront distribution"
    echo ""
    echo "Manual lookup:"
    echo "  aws cloudfront list-distributions --output table"
    exit 1
fi

echo "📡 Distribution ID: $DIST_ID"

# Parse invalidation path from argument
PATHS="${1:-/*}"

echo "📍 Invalidating paths: $PATHS"
echo ""

# Create invalidation
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "$PATHS" \
  --query 'Invalidation.Id' \
  --output text)

echo "✓ Invalidation created: $INVALIDATION_ID"
echo ""
echo "⏳ Waiting for invalidation to complete..."
echo "   (This typically takes 2-3 minutes)"

# Wait for invalidation to complete
TIMEOUT=300
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    STATUS=$(aws cloudfront get-invalidation \
      --distribution-id "$DIST_ID" \
      --id "$INVALIDATION_ID" \
      --query 'Invalidation.Status' \
      --output text)

    if [ "$STATUS" = "Completed" ]; then
        echo ""
        echo "✅ Cache invalidation complete!"
        echo ""
        echo "📊 Summary:"
        echo "   Distribution ID: $DIST_ID"
        echo "   Invalidation ID: $INVALIDATION_ID"
        echo "   Status: $STATUS"
        echo "   Paths: $PATHS"
        echo ""
        echo "🚀 Your changes are now live worldwide!"
        exit 0
    fi

    echo -n "."
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

echo ""
echo "⚠️  Invalidation still processing (taking longer than expected)"
echo "   Check status with:"
echo "   aws cloudfront get-invalidation --distribution-id $DIST_ID --id $INVALIDATION_ID"
