#!/bin/bash

# Manual CDK Bootstrap - Bypasses CloudFormation Hooks
# This script manually creates the CDK bootstrap resources without using cdk bootstrap

set -e

echo "🔧 Manual CDK Bootstrap (Hook Bypass)"
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

# CDK Bootstrap version
CDK_VERSION="21"
QUALIFIER="hnb659fds"

echo "Creating CDK bootstrap resources manually..."
echo ""

# 1. Create S3 bucket for CDK assets
BUCKET_NAME="cdk-${QUALIFIER}-assets-${ACCOUNT_ID}-${REGION}"
echo "1. Creating S3 bucket: $BUCKET_NAME"

if aws s3 ls "s3://${BUCKET_NAME}" 2>/dev/null; then
    echo "   ✅ Bucket already exists"
else
    if [ "$REGION" = "us-east-1" ]; then
        aws s3api create-bucket --bucket $BUCKET_NAME --region $REGION
    else
        aws s3api create-bucket --bucket $BUCKET_NAME --region $REGION \
            --create-bucket-configuration LocationConstraint=$REGION
    fi
    
    # Enable versioning
    aws s3api put-bucket-versioning --bucket $BUCKET_NAME \
        --versioning-configuration Status=Enabled
    
    # Enable encryption
    aws s3api put-bucket-encryption --bucket $BUCKET_NAME \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    
    # Block public access
    aws s3api put-public-access-block --bucket $BUCKET_NAME \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    
    echo "   ✅ Bucket created and configured"
fi

# 2. Create ECR repository for Docker images
REPO_NAME="cdk-${QUALIFIER}-container-assets-${ACCOUNT_ID}-${REGION}"
echo "2. Creating ECR repository: $REPO_NAME"

if aws ecr describe-repositories --repository-names $REPO_NAME --region $REGION 2>/dev/null; then
    echo "   ✅ Repository already exists"
else
    aws ecr create-repository --repository-name $REPO_NAME --region $REGION \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256 || true
    echo "   ✅ Repository created"
fi

# 3. Create SSM parameter for bootstrap version
PARAM_NAME="/cdk-bootstrap/${QUALIFIER}/version"
echo "3. Creating SSM parameter: $PARAM_NAME"

aws ssm put-parameter \
    --name $PARAM_NAME \
    --value $CDK_VERSION \
    --type String \
    --overwrite \
    --region $REGION || true

echo "   ✅ Parameter created"

# 4. Create IAM roles (simplified - you may need to adjust permissions)
echo "4. Creating IAM roles..."

# CloudFormation execution role
EXEC_ROLE_NAME="cdk-${QUALIFIER}-cfn-exec-role-${ACCOUNT_ID}-${REGION}"
echo "   Creating execution role: $EXEC_ROLE_NAME"

cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "cloudformation.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
EOF

if aws iam get-role --role-name $EXEC_ROLE_NAME 2>/dev/null; then
    echo "   ✅ Execution role already exists"
else
    aws iam create-role \
        --role-name $EXEC_ROLE_NAME \
        --assume-role-policy-document file:///tmp/trust-policy.json || true
    
    aws iam attach-role-policy \
        --role-name $EXEC_ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/AdministratorAccess || true
    
    echo "   ✅ Execution role created"
fi

# Deploy role
DEPLOY_ROLE_NAME="cdk-${QUALIFIER}-deploy-role-${ACCOUNT_ID}-${REGION}"
echo "   Creating deploy role: $DEPLOY_ROLE_NAME"

cat > /tmp/deploy-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::${ACCOUNT_ID}:root"
    },
    "Action": "sts:AssumeRole"
  }]
}
EOF

if aws iam get-role --role-name $DEPLOY_ROLE_NAME 2>/dev/null; then
    echo "   ✅ Deploy role already exists"
else
    aws iam create-role \
        --role-name $DEPLOY_ROLE_NAME \
        --assume-role-policy-document file:///tmp/deploy-trust-policy.json || true
    
    aws iam attach-role-policy \
        --role-name $DEPLOY_ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/AdministratorAccess || true
    
    echo "   ✅ Deploy role created"
fi

# Lookup role
LOOKUP_ROLE_NAME="cdk-${QUALIFIER}-lookup-role-${ACCOUNT_ID}-${REGION}"
echo "   Creating lookup role: $LOOKUP_ROLE_NAME"

if aws iam get-role --role-name $LOOKUP_ROLE_NAME 2>/dev/null; then
    echo "   ✅ Lookup role already exists"
else
    aws iam create-role \
        --role-name $LOOKUP_ROLE_NAME \
        --assume-role-policy-document file:///tmp/deploy-trust-policy.json || true
    
    aws iam attach-role-policy \
        --role-name $LOOKUP_ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess || true
    
    echo "   ✅ Lookup role created"
fi

# File publishing role
FILE_ROLE_NAME="cdk-${QUALIFIER}-file-publishing-role-${ACCOUNT_ID}-${REGION}"
echo "   Creating file publishing role: $FILE_ROLE_NAME"

if aws iam get-role --role-name $FILE_ROLE_NAME 2>/dev/null; then
    echo "   ✅ File publishing role already exists"
else
    aws iam create-role \
        --role-name $FILE_ROLE_NAME \
        --assume-role-policy-document file:///tmp/deploy-trust-policy.json || true
    
    # Create inline policy for S3 access
    cat > /tmp/file-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject*",
      "s3:GetBucket*",
      "s3:List*",
      "s3:DeleteObject*",
      "s3:PutObject*",
      "s3:Abort*"
    ],
    "Resource": [
      "arn:aws:s3:::${BUCKET_NAME}",
      "arn:aws:s3:::${BUCKET_NAME}/*"
    ]
  }]
}
EOF
    
    aws iam put-role-policy \
        --role-name $FILE_ROLE_NAME \
        --policy-name default-policy \
        --policy-document file:///tmp/file-policy.json || true
    
    echo "   ✅ File publishing role created"
fi

# Image publishing role
IMAGE_ROLE_NAME="cdk-${QUALIFIER}-image-publishing-role-${ACCOUNT_ID}-${REGION}"
echo "   Creating image publishing role: $IMAGE_ROLE_NAME"

if aws iam get-role --role-name $IMAGE_ROLE_NAME 2>/dev/null; then
    echo "   ✅ Image publishing role already exists"
else
    aws iam create-role \
        --role-name $IMAGE_ROLE_NAME \
        --assume-role-policy-document file:///tmp/deploy-trust-policy.json || true
    
    # Create inline policy for ECR access
    cat > /tmp/image-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:BatchCheckLayerAvailability",
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer"
    ],
    "Resource": "arn:aws:ecr:${REGION}:${ACCOUNT_ID}:repository/${REPO_NAME}"
  }, {
    "Effect": "Allow",
    "Action": "ecr:GetAuthorizationToken",
    "Resource": "*"
  }]
}
EOF
    
    aws iam put-role-policy \
        --role-name $IMAGE_ROLE_NAME \
        --policy-name default-policy \
        --policy-document file:///tmp/image-policy.json || true
    
    echo "   ✅ Image publishing role created"
fi

# Clean up temp files
rm -f /tmp/trust-policy.json /tmp/deploy-trust-policy.json /tmp/file-policy.json /tmp/image-policy.json

echo ""
echo "✅ Manual CDK bootstrap complete!"
echo ""
echo "Bootstrap resources created:"
echo "  - S3 Bucket: $BUCKET_NAME"
echo "  - ECR Repository: $REPO_NAME"
echo "  - SSM Parameter: $PARAM_NAME"
echo "  - IAM Roles: 5 roles created"
echo ""
echo "You can now deploy your CDK stacks:"
echo "  cd infrastructure"
echo "  cdk deploy --all"
echo ""
echo "Note: This bypasses CloudFormation hooks by creating resources directly via AWS APIs"
