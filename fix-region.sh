#!/bin/bash

# Fix region issue - switch to fallback region if current has issues

echo "🔧 Checking region configuration..."
echo ""

CURRENT_REGION=$(aws configure get region)
FALLBACK_REGION="us-east-1"
PROBLEMATIC_REGIONS=("us-west-2")

echo "Current region: $CURRENT_REGION"

# Check if current region is problematic
IS_PROBLEMATIC=false
for region in "${PROBLEMATIC_REGIONS[@]}"; do
    if [ "$CURRENT_REGION" = "$region" ]; then
        IS_PROBLEMATIC=true
        break
    fi
done

if [ "$IS_PROBLEMATIC" = true ]; then
    echo "⚠️  $CURRENT_REGION has CloudFormation hooks that block CDK bootstrap"
    echo "   Switching to $FALLBACK_REGION..."
    
    aws configure set region $FALLBACK_REGION
    
    # Clean CDK context
    [ -f "infrastructure/cdk.context.json" ] && rm infrastructure/cdk.context.json
    [ -f "infrastructure/cdk.out" ] && rm -rf infrastructure/cdk.out
    
    echo "✅ Region changed to $FALLBACK_REGION"
else
    echo "✅ Region $CURRENT_REGION is compatible"
fi

echo ""
echo "Current region: $(aws configure get region)"
echo "Ready to deploy: ./deploy.sh"
