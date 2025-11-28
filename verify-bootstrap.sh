#!/bin/bash

# Verify CDK Bootstrap Resources
# Checks if all required CDK bootstrap resources exist

set -e

echo "🔍 Verifying CDK Bootstrap Resources"
echo "====================================="
echo ""

# Get AWS account details
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo ""

QUALIFIER="hnb659fds"
ALL_GOOD=true

# Check 1: SSM Parameter
echo "1. Checking SSM Parameter..."
PARAM_NAME="/cdk-bootstrap/${QUALIFIER}/version"
if aws ssm get-parameter --name $PARAM_NAME --region $REGION &>/dev/null; then
    VERSION=$(aws ssm get-parameter --name $PARAM_NAME --region $REGION --query 'Parameter.Value' --output text)
    echo "   ✅ Parameter exists: $PARAM_NAME (version: $VERSION)"
else
    echo "   ❌ Parameter missing: $PARAM_NAME"
    ALL_GOOD=false
fi

# Check 2: S3 Bucket
echo "2. Checking S3 Bucket..."
BUCKET_NAME="cdk-${QUALIFIER}-assets-${ACCOUNT_ID}-${REGION}"
if aws s3 ls "s3://${BUCKET_NAME}" &>/dev/null; then
    echo "   ✅ Bucket exists: $BUCKET_NAME"
    
    # Check versioning
    VERSIONING=$(aws s3api get-bucket-versioning --bucket $BUCKET_NAME --query 'Status' --output text)
    if [ "$VERSIONING" = "Enabled" ]; then
        echo "      ✅ Versioning enabled"
    else
        echo "      ⚠️  Versioning not enabled"
    fi
else
    echo "   ❌ Bucket missing: $BUCKET_NAME"
    ALL_GOOD=false
fi

# Check 3: ECR Repository
echo "3. Checking ECR Repository..."
REPO_NAME="cdk-${QUALIFIER}-container-assets-${ACCOUNT_ID}-${REGION}"
if aws ecr describe-repositories --repository-names $REPO_NAME --region $REGION &>/dev/null; then
    echo "   ✅ Repository exists: $REPO_NAME"
else
    echo "   ⚠️  Repository missing: $REPO_NAME (optional for non-Docker deployments)"
fi

# Check 4: IAM Roles
echo "4. Checking IAM Roles..."

ROLES=(
    "cdk-${QUALIFIER}-cfn-exec-role-${ACCOUNT_ID}-${REGION}"
    "cdk-${QUALIFIER}-deploy-role-${ACCOUNT_ID}-${REGION}"
    "cdk-${QUALIFIER}-lookup-role-${ACCOUNT_ID}-${REGION}"
    "cdk-${QUALIFIER}-file-publishing-role-${ACCOUNT_ID}-${REGION}"
    "cdk-${QUALIFIER}-image-publishing-role-${ACCOUNT_ID}-${REGION}"
)

ROLES_OK=0
ROLES_MISSING=0

for role in "${ROLES[@]}"; do
    if aws iam get-role --role-name $role &>/dev/null; then
        echo "   ✅ Role exists: $role"
        ((ROLES_OK++))
    else
        echo "   ❌ Role missing: $role"
        ((ROLES_MISSING++))
        ALL_GOOD=false
    fi
done

echo ""
echo "Summary:"
echo "--------"
echo "Roles found: $ROLES_OK/5"

if [ "$ALL_GOOD" = true ]; then
    echo ""
    echo "✅ CDK Bootstrap is complete and healthy!"
    echo ""
    echo "You can now deploy CDK stacks:"
    echo "  cd infrastructure"
    echo "  cdk deploy --all"
    echo ""
    echo "Or use the main deploy script:"
    echo "  ./deploy.sh"
    exit 0
else
    echo ""
    echo "❌ CDK Bootstrap is incomplete or missing resources"
    echo ""
    echo "To fix:"
    echo "1. Run manual bootstrap: ./bootstrap-manual.sh"
    echo "2. Or run regular bootstrap: cdk bootstrap"
    echo "3. Or contact AWS administrator"
    echo ""
    echo "For more help, see: BOOTSTRAP_SOLUTIONS.md"
    exit 1
fi
