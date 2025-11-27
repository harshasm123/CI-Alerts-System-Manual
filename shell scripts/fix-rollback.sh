#!/bin/bash

# Fix CloudFormation Rollback and Dependency Issues

set -e

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

echo "🔧 Fixing CloudFormation stack rollback issues..."
echo "Region: $REGION"
echo ""

# Step 1: Delete dependent stacks first (reverse order)
echo "Step 1: Deleting dependent stacks in reverse order..."

# Delete CICD (depends on all)
if aws cloudformation describe-stacks --stack-name CIAlert-CICD --region $REGION &>/dev/null; then
    echo "  Deleting CIAlert-CICD..."
    aws cloudformation delete-stack --stack-name CIAlert-CICD --region $REGION
    echo "  Waiting for deletion..."
    aws cloudformation wait stack-delete-complete --stack-name CIAlert-CICD --region $REGION 2>/dev/null || true
    echo "  ✅ CIAlert-CICD deleted"
fi

# Delete Monitoring (depends on Core)
if aws cloudformation describe-stacks --stack-name CIAlert-Monitoring --region $REGION &>/dev/null; then
    echo "  Deleting CIAlert-Monitoring..."
    aws cloudformation delete-stack --stack-name CIAlert-Monitoring --region $REGION
    echo "  Waiting for deletion..."
    aws cloudformation wait stack-delete-complete --stack-name CIAlert-Monitoring --region $REGION 2>/dev/null || true
    echo "  ✅ CIAlert-Monitoring deleted"
fi

# Delete Frontend (depends on Core exports)
if aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION &>/dev/null; then
    echo "  Deleting CIAlert-Frontend..."
    aws cloudformation delete-stack --stack-name CIAlert-Frontend --region $REGION
    echo "  Waiting for deletion..."
    aws cloudformation wait stack-delete-complete --stack-name CIAlert-Frontend --region $REGION 2>/dev/null || true
    echo "  ✅ CIAlert-Frontend deleted"
fi

# Step 2: Handle Core stack rollback
echo ""
echo "Step 2: Handling CIAlertStack rollback..."

CORE_STATUS=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NONE")

case $CORE_STATUS in
    "UPDATE_ROLLBACK_IN_PROGRESS")
        echo "  Stack is rolling back. Waiting for completion..."
        aws cloudformation wait stack-rollback-complete --stack-name CIAlertStack --region $REGION 2>/dev/null || true
        CORE_STATUS=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].StackStatus' --output text)
        echo "  New status: $CORE_STATUS"
        ;;
    "UPDATE_ROLLBACK_COMPLETE"|"ROLLBACK_COMPLETE"|"UPDATE_ROLLBACK_FAILED")
        echo "  Stack in rollback state: $CORE_STATUS"
        ;;
    "NONE")
        echo "  Stack does not exist"
        exit 0
        ;;
    *)
        echo "  Stack status: $CORE_STATUS"
        ;;
esac

# Step 3: Delete Core stack
echo ""
echo "Step 3: Deleting CIAlertStack..."
if [ "$CORE_STATUS" != "NONE" ]; then
    aws cloudformation delete-stack --stack-name CIAlertStack --region $REGION
    echo "  Waiting for deletion..."
    aws cloudformation wait stack-delete-complete --stack-name CIAlertStack --region $REGION 2>/dev/null || true
    echo "  ✅ CIAlertStack deleted"
fi

# Step 4: Clean up CDK context
echo ""
echo "Step 4: Cleaning CDK context..."
rm -f infrastructure/cdk.context.json
rm -rf infrastructure/cdk.out
echo "  ✅ CDK context cleaned"

echo ""
echo "🎉 Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. cd ~/CI-Alerts-System-Manual"
echo "2. ./deploy.sh"
