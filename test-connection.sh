#!/bin/bash

# Test Frontend-Backend Connection Script
set -e

echo "🔗 Testing Frontend-Backend Connection..."

# Get stack outputs
REGION=$(aws configure get region || echo "us-east-2")
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null || echo "")

echo "📋 Backend Configuration:"
echo "  API URL: $API_URL"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $USER_POOL_CLIENT_ID"
echo "  Region: $REGION"

if [ -z "$API_URL" ]; then
    echo "❌ Backend not deployed. Run: bash deploy.sh"
    exit 1
fi

# Update frontend environment
echo ""
echo "🔧 Updating frontend configuration..."
cat > frontend/.env << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_REGION=$REGION
GENERATE_SOURCEMAP=false
EOF

echo "✅ Frontend .env updated"

# Test backend endpoints
echo ""
echo "🧪 Testing Backend Endpoints..."

# Test public endpoint (should return 401 without auth)
echo "1. Testing API Gateway (expect 401 Unauthorized):"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}insights" || echo "000")
if [ "$HTTP_STATUS" = "401" ]; then
    echo "   ✅ API Gateway responding (401 Unauthorized - correct)"
elif [ "$HTTP_STATUS" = "200" ]; then
    echo "   ⚠️  API Gateway responding but no auth required"
else
    echo "   ❌ API Gateway not responding (HTTP $HTTP_STATUS)"
fi

# Test CORS
echo "2. Testing CORS headers:"
CORS_HEADERS=$(curl -s -I -X OPTIONS "${API_URL}insights" | grep -i "access-control" || echo "")
if [ -n "$CORS_HEADERS" ]; then
    echo "   ✅ CORS headers present"
else
    echo "   ⚠️  CORS headers missing"
fi

# Check Cognito User Pool
echo "3. Testing Cognito User Pool:"
POOL_STATUS=$(aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID --region $REGION --query 'UserPool.Status' --output text 2>/dev/null || echo "ERROR")
if [ "$POOL_STATUS" = "Enabled" ]; then
    echo "   ✅ Cognito User Pool active"
else
    echo "   ❌ Cognito User Pool issue: $POOL_STATUS"
fi

# Check Lambda functions
echo "4. Testing Lambda Functions:"
FUNCTIONS=$(aws lambda list-functions --region $REGION --query 'Functions[?contains(FunctionName,`CIAlertStack`)].FunctionName' --output text)
FUNC_COUNT=$(echo $FUNCTIONS | wc -w)
echo "   📊 Found $FUNC_COUNT Lambda functions"

if [ $FUNC_COUNT -ge 5 ]; then
    echo "   ✅ Core Lambda functions deployed"
else
    echo "   ⚠️  Some Lambda functions missing"
fi

# Check DynamoDB tables
echo "5. Testing DynamoDB Tables:"
TABLES=$(aws dynamodb list-tables --region $REGION --query 'TableNames[?contains(@,`CIAlertStack`)]' --output text)
TABLE_COUNT=$(echo $TABLES | wc -w)
echo "   📊 Found $TABLE_COUNT DynamoDB tables"

if [ $TABLE_COUNT -ge 3 ]; then
    echo "   ✅ Core DynamoDB tables deployed"
else
    echo "   ⚠️  Some DynamoDB tables missing"
fi

# Frontend connection test
echo ""
echo "🎨 Testing Frontend Connection..."

if [ -d "frontend" ]; then
    echo "1. Frontend directory exists: ✅"
    
    if [ -f "frontend/package.json" ]; then
        echo "2. Package.json exists: ✅"
        
        # Check if dependencies are installed
        if [ -d "frontend/node_modules" ]; then
            echo "3. Dependencies installed: ✅"
        else
            echo "3. Installing dependencies..."
            cd frontend && npm install && cd ..
            echo "   ✅ Dependencies installed"
        fi
        
        # Test build
        echo "4. Testing build..."
        cd frontend
        if npm run build > /dev/null 2>&1; then
            echo "   ✅ Frontend builds successfully"
        else
            echo "   ❌ Frontend build failed"
        fi
        cd ..
    else
        echo "2. Package.json missing: ❌"
    fi
else
    echo "1. Frontend directory missing: ❌"
fi

# ALB connection test (if deployed)
ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' --output text 2>/dev/null || echo "")

if [ -n "$ALB_URL" ]; then
    echo ""
    echo "🌐 Testing Production Frontend (ALB)..."
    echo "   ALB URL: $ALB_URL"
    
    ALB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ALB_URL" || echo "000")
    if [ "$ALB_STATUS" = "200" ]; then
        echo "   ✅ ALB responding (200 OK)"
    else
        echo "   ⚠️  ALB not ready yet (HTTP $ALB_STATUS) - ECS tasks may still be starting"
    fi
fi

echo ""
echo "📋 Connection Summary:"
echo "=============================="

if [ "$HTTP_STATUS" = "401" ] && [ "$POOL_STATUS" = "Enabled" ] && [ $FUNC_COUNT -ge 5 ] && [ $TABLE_COUNT -ge 3 ]; then
    echo "✅ Backend: Fully Connected"
else
    echo "⚠️  Backend: Partial Connection"
fi

if [ -d "frontend/build" ]; then
    echo "✅ Frontend: Build Ready"
else
    echo "⚠️  Frontend: Build Required"
fi

if [ -n "$ALB_URL" ]; then
    echo "✅ Production: ALB Deployed"
else
    echo "ℹ️  Production: ALB Not Deployed (use deploy-production.sh)"
fi

echo ""
echo "🚀 Next Steps:"
echo "1. Create test user: bash 'shell scripts/setup-test-user.sh'"
echo "2. Test API with auth: bash 'shell scripts/test.sh' api"
echo "3. Deploy frontend: bash 'shell scripts/deploy-cognito-frontend.sh'"
if [ -n "$ALB_URL" ]; then
    echo "4. Access application: $ALB_URL"
else
    echo "4. Deploy production: bash deploy-production.sh"
fi