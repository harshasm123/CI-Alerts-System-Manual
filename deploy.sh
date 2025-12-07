#!/bin/bash

# CI Alert System Deployment Script
set -e

echo "🚀 Starting CI Alert System Deployment"

# Configuration - Dynamic region detection
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-west-2"
    aws configure set region $REGION
    echo "ℹ️  No region configured. Using $REGION"
fi

# Check for problematic regions (us-east-1 has CloudFormation hooks)
PROBLEMATIC_REGIONS=("us-east-1" "eu-west-1" "ap-southeast-1")
for prob_region in "${PROBLEMATIC_REGIONS[@]}"; do
    if [ "$REGION" = "$prob_region" ]; then
        echo "⚠️  $REGION has CloudFormation hooks blocking CDK"
        echo "   This region has AWS::EarlyValidation::ResourceExistenceCheck enabled"
        REGION="us-west-2"
        aws configure set region $REGION
        echo "✅ Automatically switched to $REGION"
        echo "   If you need to use $prob_region, contact AWS administrator to disable the hook"
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
        echo ""
        echo "  ⚠️  CloudFormation hook is blocking bootstrap"
        echo "  Attempting manual bootstrap (bypasses hooks)..."
        echo ""
        
        # Try manual bootstrap
        chmod +x bootstrap-manual.sh
        if ./bootstrap-manual.sh; then
            echo "  ✅ Manual bootstrap successful"
            
            # Verify SSM parameter
            if ! aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --region $REGION &>/dev/null; then
                echo "  ❌ Manual bootstrap failed - parameter not created"
                echo ""
                echo "  Please contact your AWS administrator to:"
                echo "  1. Disable CloudFormation hook: AWS::EarlyValidation::ResourceExistenceCheck"
                echo "  2. Or grant permissions to create CDK bootstrap resources"
                exit 1
            fi
            echo "  ✅ Manual bootstrap verification passed"
        else
            echo "  ❌ Manual bootstrap also failed"
            echo ""
            echo "  Your AWS account has strict policies preventing CDK bootstrap."
            echo "  Please contact your AWS administrator to:"
            echo "  1. Disable CloudFormation hook: AWS::EarlyValidation::ResourceExistenceCheck"
            echo "  2. Or manually create CDK bootstrap resources"
            echo ""
            echo "  For more help, see: CLOUDFORMATION_HOOK_FIX.md"
            exit 1
        fi
    fi
else
    echo "  ℹ️  CDK already bootstrapped, skipping"
fi

# Step 3: Setup GitHub token for CICD stack
echo "🔑 Checking GitHub token for CICD..."
if ! aws secretsmanager describe-secret --secret-id github-token --region $REGION &>/dev/null; then
    echo "⚠️  GitHub token not found in Secrets Manager"
    echo "   CICD stack requires GitHub personal access token"
    echo ""
    read -p "Do you have a GitHub personal access token? (y/n): " has_token
    
    if [[ "$has_token" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Get token from: https://github.com/settings/tokens"
        echo "Required scopes: repo, admin:repo_hook"
        echo ""
        read -sp "Enter GitHub token: " github_token
        echo ""
        
        aws secretsmanager create-secret \
            --name github-token \
            --secret-string "$github_token" \
            --region $REGION
        
        echo "✅ GitHub token stored in Secrets Manager"
    else
        echo ""
        echo "⚠️  Skipping CICD stack deployment (no GitHub token)"
        echo "   To deploy later:"
        echo "   1. Create token: https://github.com/settings/tokens"
        echo "   2. Store: aws secretsmanager create-secret --name github-token --secret-string TOKEN --region $REGION"
        echo "   3. Deploy: cd infrastructure && cdk deploy CIAlert-CICD"
        SKIP_CICD=true
    fi
else
    echo "✅ GitHub token found in Secrets Manager"
fi

# Step 4: Install dependencies
echo "📦 Installing dependencies..."

# Infrastructure dependencies
cd infrastructure
npm install
cd ..

# Step 5: Build and deploy infrastructure
echo "🏗️  Building and deploying infrastructure..."
cd infrastructure
npm run build

# Function to check if stack exists
check_stack_exists() {
    local stack_name=$1
    aws cloudformation describe-stacks --stack-name "$stack_name" --region $REGION &>/dev/null
    return $?
}

# Function to deploy stack if needed
deploy_stack_if_needed() {
    local stack_name=$1
    if check_stack_exists "$stack_name"; then
        echo "  ✓ $stack_name already exists - checking for updates..."
        cdk deploy $stack_name --require-approval never
    else
        echo "  + Creating $stack_name..."
        cdk deploy $stack_name --require-approval never
    fi
}

echo "📋 Checking and deploying stacks in order..."
echo ""

# Production-grade deployment sequence
DEPLOYED_STACKS=()
FAILED_STACKS=()

deploy_stack() {
    local stack_name=$1
    local context_args=$2
    local description=$3
    echo ""
    echo "📦 Deploying $stack_name ($description)..."
    
    if cdk deploy $stack_name --require-approval never $context_args; then
        DEPLOYED_STACKS+=("$stack_name")
        echo "✅ $stack_name deployed successfully"
        return 0
    else
        FAILED_STACKS+=("$stack_name")
        echo "❌ $stack_name failed"
        return 1
    fi
}

echo "🏗️ Production Deployment Sequence:"
echo "1. Core Infrastructure (DynamoDB, Lambda, API Gateway, Cognito)"
echo "2. Frontend (ALB, ECS Fargate, VPC, WAF)"
echo "3. Monitoring (CloudWatch, Alarms, SNS)"
echo "4. CI/CD Pipeline (Optional)"
echo "5. Knowledge Base & Bedrock Agent (Manual)"
echo ""

# Helper function to check and deploy stack
check_and_deploy() {
    local stack_name=$1
    local context_args=$2
    local description=$3
    
    if aws cloudformation describe-stacks --stack-name $stack_name --region $REGION &>/dev/null; then
        STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $stack_name --region $REGION --query 'Stacks[0].StackStatus' --output text)
        if [[ "$STACK_STATUS" == "CREATE_COMPLETE" || "$STACK_STATUS" == "UPDATE_COMPLETE" ]]; then
            echo "✅ $stack_name already exists and is healthy ($STACK_STATUS)"
            DEPLOYED_STACKS+=("$stack_name")
            return 0
        else
            echo "⚠️  $stack_name exists but in $STACK_STATUS state, updating..."
        fi
    fi
    deploy_stack "$stack_name" "$context_args" "$description"
}

# 1. Core Infrastructure (Foundation)
check_and_deploy "CIAlertStack" "" "Core Infrastructure"

# Get outputs from core stack for frontend configuration
if [[ " ${DEPLOYED_STACKS[@]} " =~ " CIAlertStack " ]]; then
    echo "📋 Extracting core stack outputs..."
    API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
    USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")
    USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null || echo "")
    
    echo "  ✅ API URL: $API_URL"
    echo "  ✅ User Pool ID: $USER_POOL_ID"
    echo "  ✅ Client ID: $USER_POOL_CLIENT_ID"
else
    echo "❌ Core stack failed - cannot proceed with frontend"
    exit 1
fi

# 2. Frontend (Optional - ALB + ECS Fargate)
read -p "Deploy Frontend stack (ALB + ECS)? (y/n): " deploy_frontend
if [[ "$deploy_frontend" =~ ^[Yy]$ ]]; then
    FRONTEND_CONTEXT="--context apiUrl=$API_URL --context userPoolId=$USER_POOL_ID --context userPoolClientId=$USER_POOL_CLIENT_ID --context region=$REGION"
    check_and_deploy "CIAlert-Frontend" "$FRONTEND_CONTEXT" "Frontend (ALB + ECS)"
fi

# 3. Monitoring (Optional - CloudWatch dashboards)
read -p "Deploy Monitoring stack? (y/n): " deploy_monitoring
if [[ "$deploy_monitoring" =~ ^[Yy]$ ]]; then
    check_and_deploy "CIAlert-Monitoring" "" "Monitoring"
fi

# 4. CI/CD (Optional - GitHub pipeline)
if [ "$SKIP_CICD" != true ]; then
    read -p "Deploy CI/CD stack? (y/n): " deploy_cicd
    if [[ "$deploy_cicd" =~ ^[Yy]$ ]]; then
        check_and_deploy "CIAlert-CICD" "" "CI/CD Pipeline"
    fi
fi

# 5. Knowledge Base & Bedrock Agent (Manual setup required)
echo ""
echo "🧠 Manual Setup Required (CloudFormation hooks block automation):"
echo "  ⚠️  Knowledge Base: AWS Console → Bedrock → Knowledge bases"
echo "  ⚠️  Bedrock Agent: AWS Console → Bedrock → Agents"
echo "  🔗 Connect: Update Lambda env vars with Agent ID and KB ID"

cd ..

# Step 6: Production Deployment Summary
echo ""
echo "🎆 Production Deployment Summary"
echo "==============================="
echo ""
echo "✅ Successfully Deployed (${#DEPLOYED_STACKS[@]} stacks):"
for stack in "${DEPLOYED_STACKS[@]}"; do
    echo "  ✓ $stack"
done

if [ ${#FAILED_STACKS[@]} -gt 0 ]; then
    echo ""
    echo "❌ Failed Deployments (${#FAILED_STACKS[@]} stacks):"
    for stack in "${FAILED_STACKS[@]}"; do
        echo "  ✗ $stack"
    done
fi

# Get ALB URL if frontend deployed
if [[ " ${DEPLOYED_STACKS[@]} " =~ " CIAlert-Frontend " ]]; then
    ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' --output text 2>/dev/null || echo "")
    if [ -n "$ALB_URL" ]; then
        echo ""
        echo "🌍 Production Application URL:"
        echo "  $ALB_URL"
    fi
fi

echo ""
echo "📋 Manual Bedrock Setup Instructions:"
echo "1. AWS Console → Bedrock → Knowledge bases → Create (ci-alert-knowledge-base)"
echo "2. AWS Console → Bedrock → Agents → Create (ci-alert-agent)"
echo "3. Update Lambda env vars with Agent ID and KB ID"
echo ""
echo "🚀 Next Steps:"
echo "1. Wait 5-10 minutes for ECS tasks to start"
echo "2. Test application at ALB URL"
echo "3. Enable Bedrock models for AI features"
echo "4. Setup SES for email notifications"
echo "5. Configure monitoring alerts"

# Step 7: Get stack outputs
echo "📋 Getting stack outputs..."
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")

# Step 8: Test deployment
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
echo "  ✓ CIAlert-KnowledgeBase (S3 + OpenSearch + Bedrock KB)"
echo "  ✓ CIAlert-BedrockAgent (Bedrock Agent + RAG Actions)"
echo "  ✓ CIAlert-Frontend (S3 Static Website + CloudFront)"
echo "  ✓ CIAlert-Monitoring (CloudWatch, Alarms, SNS)"
if [ "$SKIP_CICD" = true ]; then
    echo "  ✗ CIAlert-CICD (Skipped - no GitHub token)"
else
    echo "  ✓ CIAlert-CICD (GitHub + CodePipeline)"
fi
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
echo "1. Enable Bedrock models: AWS Console → Bedrock → Model Access → Enable Claude 3.5 Sonnet v2 + Claude 3.5 Haiku + Titan Embeddings"
echo "2. Upload sample data: ./upload-sample-data.sh"
echo "3. Deploy frontend: bash deploy-cognito-frontend.sh"
echo "4. Create test user (see QUICKSTART.md)"
if [ "$SKIP_CICD" = true ]; then
    echo "4. Setup GitHub token to deploy CICD: aws secretsmanager create-secret --name github-token --secret-string YOUR_TOKEN --region $REGION"
    echo "5. Deploy CICD: cd infrastructure && cdk deploy CIAlert-CICD"
fi
echo ""
if [ "$SKIP_CICD" = true ]; then
    echo "✅ 5 stacks deployed successfully (CICD skipped)!"
else
    echo "✅ All 6 stacks deployed successfully!"
fi

# Step 9: Deploy frontend application
echo ""
echo "🎨 Deploying frontend application..."
if [ -d "frontend" ] && [ -f "shell scripts/deploy-cognito-frontend.sh" ]; then
    bash "shell scripts/deploy-cognito-frontend.sh"
    echo ""
    echo "✅ Frontend deployed successfully!"
else
    echo "⚠️  Frontend directory or deployment script not found"
    echo "   To deploy frontend later, run: bash 'shell scripts/deploy-cognito-frontend.sh'"
fi

echo ""
echo "🎉 Complete deployment finished!"
echo "   Open your website URL and test all features"