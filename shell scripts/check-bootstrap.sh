#!/bin/bash

# Check CDK Bootstrap Health

echo "🔍 Checking CDK Bootstrap Status..."
echo ""

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Region: $REGION"
echo "Account: $ACCOUNT_ID"
echo ""

# Check CDKToolkit Stack
echo "=== CDKToolkit Stack ==="
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
    echo "❌ CDKToolkit stack not found"
    echo "   Run: cdk bootstrap aws://${ACCOUNT_ID}/${REGION}"
    exit 1
elif [ "$STACK_STATUS" = "CREATE_COMPLETE" ] || [ "$STACK_STATUS" = "UPDATE_COMPLETE" ]; then
    echo "✅ Status: $STACK_STATUS"
else
    echo "⚠️  Status: $STACK_STATUS"
    if [ "$STACK_STATUS" = "ROLLBACK_COMPLETE" ]; then
        echo "   Stack is in failed state. Delete and re-bootstrap:"
        echo "   aws cloudformation delete-stack --stack-name CDKToolkit --region $REGION"
        echo "   aws cloudformation wait stack-delete-complete --stack-name CDKToolkit --region $REGION"
        echo "   cdk bootstrap aws://${ACCOUNT_ID}/${REGION}"
        exit 1
    fi
fi

# Check S3 Bucket
echo ""
echo "=== CDK Assets Bucket ==="
BUCKET_NAME="cdk-hnb659fds-assets-${ACCOUNT_ID}-${REGION}"
if aws s3 ls "s3://${BUCKET_NAME}" &>/dev/null; then
    echo "✅ Bucket exists: s3://${BUCKET_NAME}"
else
    echo "❌ Bucket not found: s3://${BUCKET_NAME}"
    exit 1
fi

# Check SSM Parameter
echo ""
echo "=== Bootstrap Version Parameter ==="
if VERSION=$(aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --region $REGION --query 'Parameter.Value' --output text 2>/dev/null); then
    echo "✅ Version: $VERSION"
else
    echo "❌ Parameter /cdk-bootstrap/hnb659fds/version not found"
    echo "   Bootstrap is incomplete. Re-run:"
    echo "   cdk bootstrap aws://${ACCOUNT_ID}/${REGION}"
    exit 1
fi

# Check IAM Roles
echo ""
echo "=== CDK IAM Roles ==="
ROLES=(
    "cdk-hnb659fds-deploy-role-${ACCOUNT_ID}-${REGION}"
    "cdk-hnb659fds-file-publishing-role-${ACCOUNT_ID}-${REGION}"
    "cdk-hnb659fds-image-publishing-role-${ACCOUNT_ID}-${REGION}"
    "cdk-hnb659fds-lookup-role-${ACCOUNT_ID}-${REGION}"
)

ALL_ROLES_EXIST=true
for role in "${ROLES[@]}"; do
    if aws iam get-role --role-name "$role" &>/dev/null; then
        echo "✅ $role"
    else
        echo "❌ $role (missing)"
        ALL_ROLES_EXIST=false
    fi
done

echo ""
if [ "$ALL_ROLES_EXIST" = true ]; then
    echo "🎉 CDK Bootstrap is healthy and ready!"
    echo ""
    echo "Next: ./deploy.sh"
else
    echo "⚠️  Bootstrap is incomplete. Re-run:"
    echo "   cdk bootstrap aws://${ACCOUNT_ID}/${REGION}"
    exit 1
fi
