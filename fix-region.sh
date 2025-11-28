#!/bin/bash

# Fix CloudFormation Hook Validation Issues
# This script helps resolve AWS::EarlyValidation::ResourceExistenceCheck errors

set -e

echo "🔧 CloudFormation Hook Validation Fix"
echo "======================================"
echo ""

# Get current region
CURRENT_REGION=$(aws configure get region)
echo "Current region: $CURRENT_REGION"
echo ""

# List of regions known to have CloudFormation hook issues
PROBLEMATIC_REGIONS=("us-west-2" "eu-west-1" "ap-southeast-1")

# Check if current region is problematic
IS_PROBLEMATIC=false
for region in "${PROBLEMATIC_REGIONS[@]}"; do
    if [ "$CURRENT_REGION" = "$region" ]; then
        IS_PROBLEMATIC=true
        break
    fi
done

if [ "$IS_PROBLEMATIC" = true ]; then
    echo "⚠️  Your region ($CURRENT_REGION) has known CloudFormation hook validation issues"
    echo ""
    echo "Options to fix:"
    echo "1. Switch to a different region (recommended)"
    echo "2. Contact AWS administrator to disable the hook"
    echo ""
    read -p "Do you want to switch to us-east-1? (y/n): " switch_region
    
    if [[ "$switch_region" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Switching to us-east-1..."
        aws configure set region us-east-1
        echo "✅ Region switched to us-east-1"
        echo ""
        echo "Please run ./deploy.sh again"
    else
        echo ""
        echo "To manually switch region, run:"
        echo "  aws configure set region us-east-1"
        echo ""
        echo "Or contact your AWS administrator to disable the CloudFormation hook:"
        echo "  Hook: AWS::EarlyValidation::ResourceExistenceCheck"
    fi
else
    echo "✅ Your region ($CURRENT_REGION) should work fine"
    echo ""
    echo "If you're still seeing errors, try:"
    echo "1. Ensure you have the latest AWS CLI: aws --version"
    echo "2. Update CDK: npm install -g aws-cdk@latest"
    echo "3. Clear CDK cache: rm -rf ~/.cdk"
    echo "4. Try a different region: aws configure set region us-east-1"
fi

echo ""
echo "For more information, see:"
echo "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/hooks.html"
