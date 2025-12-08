#!/bin/bash

# CI Alert System - Complete Deployment Script
# Consolidates all deployment, testing, and setup functionality

set -e

echo "🚀 CI Alert System - Complete Deployment"
echo "========================================"
echo ""

# Configuration
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-west-2"
    aws configure set region $REGION
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
DATA_BUCKET="ci-alert-data-${ACCOUNT_ID}-${REGION}"

echo "📋 Configuration:"
echo "  Region: $REGION"
echo "  Account: $ACCOUNT_ID"
echo "  Data Bucket: $DATA_BUCKET"
echo ""

# Function: Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    local missing=false
    
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found"
        missing=true
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found"
        missing=true
    fi
    
    if ! command -v cdk &> /dev/null; then
        echo "📦 Installing AWS CDK..."
        npm install -g aws-cdk
    fi
    
    if [ "$missing" = true ]; then
        echo "❌ Missing prerequisites. Install AWS CLI and Node.js first."
        exit 1
    fi
    
    echo "✅ Prerequisites check complete"
}

# Function: Setup SES
setup_ses() {
    echo ""
    echo "📧 Setting up Amazon SES..."
    
    read -p "Enter your email address to verify for SES: " EMAIL
    
    echo "📨 Verifying email: $EMAIL"
    aws ses verify-email-identity --email-address $EMAIL --region $REGION
    
    echo "✅ Verification email sent to $EMAIL"
    echo "⚠️  IMPORTANT: Check your inbox and click the verification link!"
    
    # Store email for later use
    echo $EMAIL > .ses-email
}

# Function: Create test user
create_test_user() {
    local USER_POOL_ID=$1
    local CLIENT_ID=$2
    
    echo ""
    echo "👤 Creating test user..."
    
    local TEST_EMAIL="test@example.com"
    local TEST_PASSWORD="TempPass123!"
    
    # Create user
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username $TEST_EMAIL \
        --user-attributes Name=email,Value=$TEST_EMAIL Name=email_verified,Value=true \
        --temporary-password $TEST_PASSWORD \
        --message-action SUPPRESS \
        --region $REGION 2>/dev/null || echo "User may already exist"
    
    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username $TEST_EMAIL \
        --password $TEST_PASSWORD \
        --permanent \
        --region $REGION 2>/dev/null || echo "Password already set"
    
    echo "✅ Test user created: $TEST_EMAIL / $TEST_PASSWORD"
}

# Function: Upload sample data
upload_sample_data() {
    echo ""
    echo "📚 Uploading sample data to knowledge base..."
    
    # Create sample documents
    mkdir -p sample-docs/documents/regulatory
    
    cat > sample-docs/documents/regulatory/keytruda-fda-approval.txt << 'EOF'
FDA APPROVAL LETTER - KEYTRUDA (pembrolizumab)

Date: September 4, 2014
Application: BLA 125514

INDICATION: Treatment of patients with unresectable or metastatic melanoma and disease progression following ipilimumab.

DOSAGE: 2 mg/kg administered as an intravenous infusion over 30 minutes every 3 weeks.

MECHANISM: Keytruda is a humanized monoclonal antibody that blocks the interaction between PD-1 and its ligands, PD-L1 and PD-L2.

CLINICAL TRIALS: Based on tumor response rate and durability of response from KEYNOTE-001 study (n=173 patients).
EOF
    
    # Upload to S3
    aws s3 cp sample-docs/ s3://$DATA_BUCKET/ --recursive 2>/dev/null || echo "Knowledge base bucket not ready yet"
    
    # Cleanup
    rm -rf sample-docs/
    
    echo "✅ Sample data uploaded"
}

# Function: Test system
test_system() {
    local API_URL=$1
    
    echo ""
    echo "🧪 Testing system..."
    
    echo "📊 Checking DynamoDB Tables..."
    local INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text)
    local WATCHLIST_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Watchlist')]|[0]" --output text)
    echo "  Insights Table: $INSIGHTS_TABLE"
    echo "  Watchlist Table: $WATCHLIST_TABLE"
    
    echo ""
    echo "🔍 Testing API endpoints..."
    echo "  GET /insights:"
    curl -s "${API_URL}insights" > /dev/null && echo "  ✅ API responding" || echo "  ⚠️  API not ready yet"
    
    echo ""
    echo "🚀 Triggering sample ingestion..."
    local PUBMED_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'PubMed')].FunctionName|[0]" --output text)
    if [ -n "$PUBMED_FUNCTION" ]; then
        aws lambda invoke --function-name "$PUBMED_FUNCTION" --payload '{"molecule":"Keytruda"}' response.json 2>/dev/null
        rm -f response.json
        echo "  ✅ Ingestion triggered"
    fi
}

# Function: Fix Bedrock permissions
fix_bedrock_permissions() {
    echo ""
    echo "🔧 Fixing Bedrock Agent Permissions..."
    
    if aws bedrock-agent list-agents --region $REGION &>/dev/null; then
        echo "  ✅ Bedrock Agent service is accessible"
        
        # Check if any agents exist and fix permissions
        local AGENTS=$(aws bedrock-agent list-agents --region $REGION --query 'agentSummaries[].agentId' --output text 2>/dev/null || echo "")
        if [ -n "$AGENTS" ]; then
            for AGENT_ID in $AGENTS; do
                echo "  🔧 Fixing permissions for agent: $AGENT_ID"
                
                # Get agent role ARN
                local ROLE_ARN=$(aws bedrock-agent get-agent --agent-id $AGENT_ID --region $REGION --query "agent.agentResourceRoleArn" --output text 2>/dev/null || echo "")
                if [ -n "$ROLE_ARN" ]; then
                    local ROLE_NAME=$(basename $ROLE_ARN)
                    echo "    Role: $ROLE_NAME"
                    
                    # Apply Bedrock permissions policy
                    aws iam put-role-policy --role-name $ROLE_NAME --policy-name BedrockAgentPolicy --policy-document '{
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Effect": "Allow",
                                "Action": [
                                    "bedrock:InvokeModel",
                                    "bedrock:InvokeModelWithResponseStream"
                                ],
                                "Resource": [
                                    "arn:aws:bedrock:'$REGION'::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
                                    "arn:aws:bedrock:'$REGION'::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
                                ]
                            },
                            {
                                "Effect": "Allow",
                                "Action": "lambda:InvokeFunction",
                                "Resource": "arn:aws:lambda:'$REGION':'$ACCOUNT_ID':function:*"
                            }
                        ]
                    }' 2>/dev/null && echo "    ✅ Permissions updated" || echo "    ⚠️  Permission update failed"
                fi
            done
        else
            echo "  ℹ️  No agents found - create manually in console"
        fi
    else
        echo "  ⚠️  Bedrock Agent service not accessible in $REGION"
    fi
}

# Main deployment function
deploy_infrastructure() {
    echo ""
    echo "🏗️  Deploying infrastructure..."
    
    cd infrastructure
    npm install
    npm run build
    
    # Deploy core stack
    echo "📦 Deploying CIAlertStack..."
    cdk deploy CIAlertStack --require-approval never
    
    # Get outputs
    local API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
    local USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
    local USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
    
    cd ..
    
    echo "✅ Core infrastructure deployed"
    echo "  API URL: $API_URL"
    echo "  User Pool: $USER_POOL_ID"
    
    # Create test user
    create_test_user $USER_POOL_ID $USER_POOL_CLIENT_ID
    
    # Test system
    test_system $API_URL
    
    # Upload sample data
    upload_sample_data
    
    # Fix Bedrock permissions
    fix_bedrock_permissions
    
    return 0
}

# Parse command line arguments
case "$1" in
    setup)
        check_prerequisites
        setup_ses
        ;;
    deploy)
        check_prerequisites
        deploy_infrastructure
        ;;
    test)
        # Get API URL
        API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null)
        test_system $API_URL
        ;;
    bedrock)
        fix_bedrock_permissions
        ;;
    clean)
        echo "🧹 Cleaning up stacks..."
        
        # Delete in reverse dependency order
        for stack in CIAlert-CICD CIAlert-Monitoring CIAlert-Frontend CIAlertStack; do
            if aws cloudformation describe-stacks --stack-name $stack --region $REGION &>/dev/null; then
                echo "  Deleting $stack..."
                aws cloudformation delete-stack --stack-name $stack --region $REGION
                aws cloudformation wait stack-delete-complete --stack-name $stack --region $REGION 2>/dev/null || true
                echo "  ✅ $stack deleted"
            fi
        done
        
        # Clean CDK context
        rm -f infrastructure/cdk.context.json
        rm -rf infrastructure/cdk.out
        echo "✅ Cleanup complete"
        ;;
    *)
        echo "Usage: $0 [setup|deploy|test|bedrock|clean]"
        echo ""
        echo "Commands:"
        echo "  setup    - Check prerequisites and setup SES"
        echo "  deploy   - Deploy complete infrastructure"
        echo "  test     - Test deployed system"
        echo "  bedrock  - Fix Bedrock Agent permissions"
        echo "  clean    - Delete all stacks and cleanup"
        echo ""
        echo "Examples:"
        echo "  $0 setup    # First time setup"
        echo "  $0 deploy   # Deploy everything"
        echo "  $0 test     # Test system"
        echo "  $0 bedrock  # Fix Bedrock permissions"
        echo "  $0 clean    # Clean up everything"
        exit 1
        ;;
esac

echo ""
echo "✅ Operation complete!"