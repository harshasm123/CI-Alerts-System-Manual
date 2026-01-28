#!/bin/bash

# Quick fix for CDK bootstrap conflicts
# Run this if you get bootstrap errors

set -e

REGION=${AWS_DEFAULT_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🔧 Fixing CDK bootstrap conflicts..."
echo "Account: $ACCOUNT_ID"
echo "Region: $REGION"

# Delete CDK bootstrap stack
echo "Deleting CDK bootstrap stack..."
aws cloudformation delete-stack --stack-name CDKToolkit --region $REGION 2>/dev/null || true

# Wait for deletion
echo "Waiting for stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name CDKToolkit --region $REGION 2>/dev/null || true

# Clean up resources
echo "Cleaning up bootstrap resources..."

# ECR repository
aws ecr delete-repository --repository-name cdk-hnb659fds-container-assets-$ACCOUNT_ID-$REGION --force --region $REGION 2>/dev/null || true

# S3 bucket
BUCKET_NAME="cdk-hnb659fds-assets-$ACCOUNT_ID-$REGION"
aws s3 rm s3://$BUCKET_NAME --recursive 2>/dev/null || true
aws s3 rb s3://$BUCKET_NAME --force 2>/dev/null || true

# SSM parameter
aws ssm delete-parameter --name "/cdk-bootstrap/hnb659fds/version" --region $REGION 2>/dev/null || true

echo "Waiting 30 seconds for cleanup..."
sleep 30

# Bootstrap fresh
echo "Bootstrapping CDK fresh..."
cdk bootstrap aws://$ACCOUNT_ID/$REGION --region $REGION

echo "✅ CDK bootstrap fixed!"
echo "Now run: ./deploy.sh production admin@example.com deploy"