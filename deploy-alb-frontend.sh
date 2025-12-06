#!/bin/bash
set -e

echo "🚀 Deploying Frontend with ALB..."
echo ""

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

echo "📋 Region: $REGION"
echo ""

# Step 1: Get API configuration from CIAlertStack
echo "🔍 Getting API configuration..."
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
    echo "❌ CIAlertStack not found or not deployed"
    echo "   Please deploy the backend first: bash deploy.sh"
    exit 1
fi

echo "✅ API URL: $API_URL"
echo "✅ User Pool: $USER_POOL_ID"
echo "✅ Region: $REGION"
echo ""

# Step 2: Fix package-lock.json and create .env file
echo "📝 Fixing frontend dependencies..."
cd frontend

# Remove package-lock.json and node_modules to force clean install
rm -rf package-lock.json node_modules

# Create .env file for Docker build
cat > .env << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_REGION=$REGION
EOF

# Generate fresh package-lock.json
echo "📦 Generating fresh package-lock.json..."
npm install

echo "✅ Configuration created and dependencies fixed"
cd ..
echo ""

# Step 3: Export environment variables for CDK
export REACT_APP_API_URL="$API_URL"
export REACT_APP_USER_POOL_ID="$USER_POOL_ID"
export REACT_APP_USER_POOL_CLIENT_ID="$USER_POOL_CLIENT_ID"
export REACT_APP_REGION="$REGION"

# Step 4: Build and deploy CDK stack
echo "🏗️  Building CDK stack..."
cd infrastructure
npm install
npm run build

echo ""
echo "📦 Deploying CIAlert-Frontend stack with ALB..."
echo "   This will:"
echo "   - Create VPC resources (if needed)"
echo "   - Create ECS Fargate cluster"
echo "   - Build Docker image from frontend"
echo "   - Create Application Load Balancer"
echo "   - Deploy frontend container"
echo ""
echo "⏳ This may take 5-10 minutes..."
echo ""

cdk deploy CIAlert-Frontend --require-approval never

cd ..

# Step 5: Get ALB URL
echo ""
echo "🔍 Getting Load Balancer URL..."
ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' --output text 2>/dev/null || echo "")

if [ -z "$ALB_URL" ]; then
    echo "⚠️  Could not retrieve ALB URL from stack outputs"
    echo "   Check CloudFormation console for CIAlert-Frontend stack"
else
    echo ""
    echo "✅ Frontend deployed successfully!"
    echo ""
    echo "🌐 Access your application at:"
    echo "   $ALB_URL"
    echo ""
    echo "📝 Note:"
    echo "   - ALB provides HTTP access (port 80)"
    echo "   - For HTTPS, you'll need to add a certificate"
    echo "   - The container may take 1-2 minutes to become healthy"
    echo ""
    echo "🧪 Test the health endpoint:"
    echo "   curl $ALB_URL/health"
fi

echo ""
echo "✅ Deployment complete!"
