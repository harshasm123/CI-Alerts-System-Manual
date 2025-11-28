#!/bin/bash

# Fix Frontend Stack - Remove CloudFront, Use S3 Only
set -e

echo "🔧 Fixing Frontend Stack (Removing CloudFront)"
echo "=============================================="

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

echo "📋 Configuration:"
echo "  Region: $REGION"
echo ""

# Step 1: Check if CIAlert-Frontend stack exists
echo "🔍 Checking for existing CIAlert-Frontend stack..."
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NONE")

if [ "$STACK_STATUS" = "NONE" ]; then
    echo "  ℹ️  No existing stack found. Will create new S3-only stack."
else
    echo "  ⚠️  Found existing stack in $STACK_STATUS state"
    echo "  This stack may contain CloudFront resources that are causing deployment failures."
    echo ""
    echo "  To fix this, we need to delete the old stack and create a new one."
    echo ""
    read -p "Delete existing CIAlert-Frontend stack? (y/n): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo ""
        echo "🗑️  Deleting CIAlert-Frontend stack..."
        aws cloudformation delete-stack --stack-name CIAlert-Frontend --region $REGION
        
        echo "  Waiting for deletion to complete (this may take a few minutes)..."
        aws cloudformation wait stack-delete-complete --stack-name CIAlert-Frontend --region $REGION 2>/dev/null || {
            echo "  ⚠️  Stack deletion timed out or failed"
            echo "  Checking status..."
            FINAL_STATUS=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
            if [ "$FINAL_STATUS" = "DELETED" ] || [ "$FINAL_STATUS" = "DELETE_COMPLETE" ]; then
                echo "  ✅ Stack deleted successfully"
            else
                echo "  ❌ Stack deletion failed with status: $FINAL_STATUS"
                echo "  Please manually delete the stack from AWS Console"
                exit 1
            fi
        }
        echo "  ✅ Old stack deleted"
    else
        echo "  ℹ️  Skipping deletion. Deployment may fail if CloudFront resources exist."
    fi
fi

# Step 2: Build infrastructure
echo ""
echo "🏗️  Building infrastructure..."
cd infrastructure
npm install
npm run build
cd ..

# Step 3: Deploy new S3-only frontend stack
echo ""
echo "📦 Deploying new S3-only frontend stack..."
cd infrastructure
cdk deploy CIAlert-Frontend --require-approval never
cd ..

# Step 4: Get outputs
echo ""
echo "📋 Getting stack outputs..."
WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' --output text 2>/dev/null || echo "")
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text 2>/dev/null || echo "")

echo ""
echo "🎉 Frontend Stack Fixed!"
echo "======================="
echo ""
echo "✅ Using S3 Static Website Hosting (No CloudFront)"
echo ""
if [ -n "$WEBSITE_URL" ]; then
    echo "🌐 Website URL: $WEBSITE_URL"
fi
if [ -n "$BUCKET_NAME" ]; then
    echo "📦 S3 Bucket: $BUCKET_NAME"
fi
echo ""
echo "📝 Next Steps:"
echo "1. Build your React frontend:"
echo "   cd frontend"
echo "   npm install"
echo "   npm run build"
echo ""
echo "2. Upload to S3:"
if [ -n "$BUCKET_NAME" ]; then
    echo "   aws s3 sync frontend/build/ s3://$BUCKET_NAME/ --delete"
else
    echo "   aws s3 sync frontend/build/ s3://YOUR_BUCKET_NAME/ --delete"
fi
echo ""
echo "3. Access your app:"
if [ -n "$WEBSITE_URL" ]; then
    echo "   $WEBSITE_URL"
else
    echo "   Check CloudFormation outputs for WebsiteURL"
fi
echo ""
echo "ℹ️  Note: S3 static website uses HTTP (not HTTPS)"
echo "   This is fine for development. Add CloudFront later for HTTPS."
echo ""
echo "✅ Done!"
