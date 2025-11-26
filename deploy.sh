#!/bin/bash

# CI Alert System Deployment Script
set -e

echo "🚀 Starting CI Alert System Deployment"

# Configuration - Dynamic region detection
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
    aws configure set region $REGION
    echo "ℹ️  No region configured. Using $REGION"
fi

# Check for problematic regions
PROBLEMATIC_REGIONS=("us-west-2")
for prob_region in "${PROBLEMATIC_REGIONS[@]}"; do
    if [ "$REGION" = "$prob_region" ]; then
        echo "⚠️  $REGION has CloudFormation hooks blocking CDK"
        REGION="us-east-1"
        aws configure set region $REGION
        echo "✅ Switched to $REGION"
        break
    fi
done

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
DATA_BUCKET="ci-alert-data-${ACCOUNT_ID}-${REGION}"

echo "📋 Configuration:"
echo "  Region: $REGION"
echo "  Account ID: $ACCOUNT_ID"
echo "  Data Bucket: $DATA_BUCKET"

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js and npm."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

if ! command -v cdk &> /dev/null; then
    echo "📦 Installing AWS CDK..."
    npm install -g aws-cdk
fi

echo "✅ Prerequisites check complete"

# Step 1: Check and clean CDKToolkit stack
echo "🧹 Checking CDKToolkit stack health..."
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NONE")

case $STACK_STATUS in
    "CREATE_COMPLETE"|"UPDATE_COMPLETE")
        echo "  ✅ CDKToolkit is healthy ($STACK_STATUS)"
        # Verify SSM parameter exists
        if aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --region $REGION &>/dev/null; then
            echo "  ✅ Bootstrap version parameter exists"
        else
            echo "  ⚠️  Bootstrap parameter missing, will re-bootstrap"
            STACK_STATUS="INCOMPLETE"
        fi
        ;;
    "ROLLBACK_COMPLETE"|"REVIEW_IN_PROGRESS"|"CREATE_FAILED"|"ROLLBACK_IN_PROGRESS")
        echo "  ⚠️  Found failed stack in $STACK_STATUS state. Cleaning up..."
        aws cloudformation delete-stack --stack-name CDKToolkit --region $REGION
        echo "  Waiting for deletion..."
        aws cloudformation wait stack-delete-complete --stack-name CDKToolkit --region $REGION 2>/dev/null || true
        echo "  ✅ Cleanup complete"
        STACK_STATUS="NONE"
        ;;
    "NONE")
        echo "  ℹ️  CDKToolkit not found, will bootstrap"
        ;;
    *)
        echo "  ℹ️  CDKToolkit status: $STACK_STATUS"
        ;;
esac

# Step 2: Bootstrap CDK (if needed)
if [ "$STACK_STATUS" = "NONE" ] || [ "$STACK_STATUS" = "INCOMPLETE" ]; then
    echo "🏗️  Bootstrapping CDK in $REGION..."
    if cdk bootstrap aws://${ACCOUNT_ID}/${REGION}; then
        echo "  ✅ CDK bootstrap successful"
        
        # Verify bootstrap completed successfully
        FINAL_STATUS=$(aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
        if [ "$FINAL_STATUS" != "CREATE_COMPLETE" ] && [ "$FINAL_STATUS" != "UPDATE_COMPLETE" ]; then
            echo "  ❌ Bootstrap failed with status: $FINAL_STATUS"
            exit 1
        fi
        
        # Verify SSM parameter
        if ! aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --region $REGION &>/dev/null; then
            echo "  ❌ Bootstrap parameter not created"
            exit 1
        fi
        echo "  ✅ Bootstrap verification passed"
    else
        echo "  ❌ CDK bootstrap failed"
        echo "     If you see AWS::EarlyValidation::ResourceExistenceCheck errors:"
        echo "     1. Run: ./fix-region.sh"
        echo "     2. Or contact AWS administrator to disable CloudFormation hook"
        exit 1
    fi
else
    echo "  ℹ️  CDK already bootstrapped, skipping"
fi

# Step 3: Install dependencies
echo "📦 Installing dependencies..."

# Infrastructure dependencies
cd infrastructure
npm install
cd ..

# Step 4: Build and deploy infrastructure
echo "🏗️  Building and deploying infrastructure..."
cd infrastructure
npm run build
echo "📦 Deploying all stacks..."
cdk deploy --all --require-approval never
cd ..

# Step 5: Get stack outputs
echo "📋 Getting stack outputs..."
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")

# Step 6: Test deployment
echo "🧪 Testing deployment..."
if [ -n "$API_URL" ]; then
    echo "Testing API endpoint: $API_URL"
    curl -s "${API_URL}insights" > /dev/null && echo "  ✅ API is responding" || echo "  ⚠️  API not responding yet"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "====================="
echo ""
echo "📊 Deployed Stacks:"
echo "  ✓ CIAlertStack (Core: DynamoDB, Lambda, API Gateway, Cognito)"
echo "  ✓ CIAlert-Frontend (ECS, CloudFront, ALB, WAF)"
echo "  ✓ CIAlert-Monitoring (CloudWatch, Alarms, SNS)"
echo "  ✓ CIAlert-CICD (CodePipeline, CodeBuild, CodeCommit)"
echo ""
echo "📋 Stack Outputs:"
echo "  Region: $REGION"
echo "  Account: $ACCOUNT_ID"
if [ -n "$API_URL" ]; then
    echo "  API URL: $API_URL"
fi
if [ -n "$USER_POOL_ID" ]; then
    echo "  User Pool: $USER_POOL_ID"
fi
echo ""
echo "🧪 Test Commands:"
echo "  # Get insights"
echo "  curl ${API_URL}insights"
echo ""
echo "  # Add to watchlist"
echo "  curl -X POST ${API_URL}watchlist -H 'Content-Type: application/json' -d '{\"molecule\":\"Keytruda\"}'"
echo ""
echo "  # Trigger ingestion"
echo "  aws lambda invoke --function-name CIAlertStack-PubMedFunction --region $REGION response.json"
echo ""
echo "📝 Next Steps:"
echo "1. View all URLs: ./GET_URLS.sh"
echo "2. Enable Bedrock models: AWS Console → Bedrock → Model Access"
echo "3. Test API endpoints using commands above"
echo "4. Check CloudWatch Dashboard for monitoring"
echo ""
echo "✅ All 4 stacks deployed successfully!"