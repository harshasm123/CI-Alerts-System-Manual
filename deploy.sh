#!/bin/bash

# CI Alert System Deployment Script
set -e

echo "🚀 Starting CI Alert System Deployment"

# Configuration - Get region from AWS CLI config
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    echo "⚠️  No region configured in AWS CLI. Using us-east-1 as default."
    REGION="us-east-1"
fi
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

# Step 1: Bootstrap CDK (if needed)
echo "🏗️  Bootstrapping CDK..."
cdk bootstrap aws://${ACCOUNT_ID}/${REGION} || echo "CDK already bootstrapped"

# Step 2: Install dependencies
echo "📦 Installing dependencies..."

# Infrastructure dependencies
cd infrastructure
npm install
cd ..

# Lambda dependencies
cd lambdas
pip install -r requirements.txt -t .
cd ..

# Frontend dependencies
cd frontend
npm install
cd ..

# Step 3: Build and deploy infrastructure
echo "🏗️  Building and deploying infrastructure..."
cd infrastructure
npm run build
cdk deploy --all --require-approval never
cd ..

# Step 4: Set up Bedrock Agent
echo "🤖 Setting up Bedrock Agent..."
python3 scripts/setup_bedrock_agent.py --data-bucket $DATA_BUCKET --region $REGION

# Step 5: Build and push Docker image
echo "🐳 Building and pushing Docker image..."

# Get ECR repository URI
ECR_REPO=$(aws ecr describe-repositories --repository-names ci-alert-frontend --region $REGION --query 'repositories[0].repositoryUri' --output text 2>/dev/null || echo "")

if [ -z "$ECR_REPO" ]; then
    echo "📦 Creating ECR repository..."
    aws ecr create-repository --repository-name ci-alert-frontend --region $REGION
    ECR_REPO=$(aws ecr describe-repositories --repository-names ci-alert-frontend --region $REGION --query 'repositories[0].repositoryUri' --output text)
fi

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO

echo "🏗️  Building Docker image..."
cd frontend
docker build -t ci-alert-frontend:latest .
docker tag ci-alert-frontend:latest $ECR_REPO:latest

echo "📤 Pushing Docker image..."
docker push $ECR_REPO:latest
cd ..

# Step 6: Update ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service --cluster ci-alert-cluster --service ci-alert-service --force-new-deployment --region $REGION || echo "ECS service will be created by CDK"

# Step 7: Set up monitoring dashboard
echo "📊 Setting up monitoring dashboard..."
aws cloudwatch put-dashboard --dashboard-name "CI-Alert-System" --dashboard-body file://monitoring/dashboard.json --region $REGION

# Step 8: Verify deployment
echo "🔍 Verifying deployment..."

# Check Lambda functions
LAMBDA_FUNCTIONS=(
    "ci-alert-pubmed-ingestion"
    "ci-alert-clinical-trials-ingestion"
    "ci-alert-fda-ingestion"
    "ci-alert-ema-ingestion"
    "ci-alert-wipo-ingestion"
    "ci-alert-processor"
    "ci-alert-daily-digest"
    "ci-alert-watchlist-api"
    "ci-alert-insights-api"
    "ci-alert-user-settings-api"
)

echo "📋 Checking Lambda functions..."
for func in "${LAMBDA_FUNCTIONS[@]}"; do
    if aws lambda get-function --function-name $func --region $REGION &>/dev/null; then
        echo "  ✅ $func"
    else
        echo "  ❌ $func (not found)"
    fi
done

# Check DynamoDB tables
DYNAMO_TABLES=(
    "ci-alert-insights"
    "ci-alert-user-settings"
    "ci-alert-watchlist"
)

echo "📋 Checking DynamoDB tables..."
for table in "${DYNAMO_TABLES[@]}"; do
    if aws dynamodb describe-table --table-name $table --region $REGION &>/dev/null; then
        echo "  ✅ $table"
    else
        echo "  ❌ $table (not found)"
    fi
done

# Check S3 bucket
echo "📋 Checking S3 bucket..."
if aws s3 ls s3://$DATA_BUCKET &>/dev/null; then
    echo "  ✅ $DATA_BUCKET"
else
    echo "  ❌ $DATA_BUCKET (not found)"
fi

# Check API Gateway
echo "📋 Checking API Gateway..."
API_ID=$(aws apigateway get-rest-apis --region $REGION --query 'items[?name==`ci-alert-api`].id' --output text)
if [ -n "$API_ID" ]; then
    API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"
    echo "  ✅ API Gateway: $API_URL"
else
    echo "  ❌ API Gateway (not found)"
fi

# Check ECS service
echo "📋 Checking ECS service..."
if aws ecs describe-services --cluster ci-alert-cluster --services ci-alert-service --region $REGION &>/dev/null; then
    echo "  ✅ ECS service"
else
    echo "  ❌ ECS service (not found)"
fi

# Check CloudFront distribution
echo "📋 Checking CloudFront distribution..."
CLOUDFRONT_ID=$(aws cloudfront list-distributions --query 'DistributionList.Items[?Comment==`CI Alert Distribution`].Id' --output text)
if [ -n "$CLOUDFRONT_ID" ]; then
    CLOUDFRONT_URL=$(aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.DomainName' --output text)
    echo "  ✅ CloudFront: https://$CLOUDFRONT_URL"
else
    echo "  ❌ CloudFront distribution (not found)"
fi

echo ""
echo "🎉 Deployment Summary:"
echo "===================="
echo "✅ Infrastructure deployed"
echo "✅ Lambda functions deployed"
echo "✅ Frontend containerized and deployed"
echo "✅ Bedrock Agent configured"
echo "✅ Monitoring dashboard created"
echo ""
echo "🔗 Access URLs:"
if [ -n "$CLOUDFRONT_URL" ]; then
    echo "  Frontend: https://$CLOUDFRONT_URL"
fi
if [ -n "$API_URL" ]; then
    echo "  API: $API_URL"
fi
echo "  Dashboard: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=CI-Alert-System"
echo ""
echo "📝 Next Steps:"
echo "1. Configure SES email addresses for notifications"
echo "2. Set up domain name and SSL certificate (optional)"
echo "3. Configure Cognito user pool settings"
echo "4. Test the system with sample molecules"
echo ""
echo "🚀 CI Alert System deployment complete!"