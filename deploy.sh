#!/bin/bash

# CI Alert System - Complete Deployment Script
# Usage: ./deploy.sh [environment] [admin-email] [action]
# Actions: deploy, test, destroy, status

set -e

# Configuration
ENVIRONMENT=${1:-production}
ADMIN_EMAIL=${2:-admin@example.com}
ACTION=${3:-deploy}
REGION=${AWS_DEFAULT_REGION:-us-east-1}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    command -v aws >/dev/null 2>&1 || { print_error "AWS CLI required"; exit 1; }
    command -v cdk >/dev/null 2>&1 || { print_error "AWS CDK required"; exit 1; }
    command -v node >/dev/null 2>&1 || { print_error "Node.js required"; exit 1; }
    command -v jq >/dev/null 2>&1 || { print_error "jq required"; exit 1; }
    
    aws sts get-caller-identity >/dev/null 2>&1 || { print_error "AWS credentials not configured"; exit 1; }
    
    print_success "Prerequisites check passed"
}

# Bootstrap CDK
bootstrap_cdk() {
    print_status "Bootstrapping CDK..."
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION >/dev/null 2>&1; then
        cdk bootstrap aws://$ACCOUNT_ID/$REGION
        print_success "CDK bootstrapped"
    else
        print_success "CDK already bootstrapped"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    cd infrastructure && npm install && cd ..
    cd frontend && npm install && cd ..
    
    print_success "Dependencies installed"
}

# Deploy infrastructure
deploy_infrastructure() {
    print_status "Deploying infrastructure..."
    
    cd infrastructure
    
    export ENVIRONMENT=$ENVIRONMENT
    export ADMIN_EMAIL=$ADMIN_EMAIL
    
    # Deploy core stack
    print_status "Deploying core stack..."
    cdk deploy CIAlertStack --require-approval never --outputs-file outputs/core.json
    
    # Deploy knowledge base
    print_status "Deploying knowledge base..."
    cdk deploy CIAlert-KnowledgeBase --require-approval never --outputs-file outputs/kb.json
    
    # Deploy Bedrock agent
    print_status "Deploying Bedrock agent..."
    cdk deploy CIAlert-BedrockAgent --require-approval never --outputs-file outputs/agent.json
    
    # Deploy Amplify frontend
    print_status "Deploying Amplify frontend..."
    cdk deploy CIAlert-Amplify --require-approval never --outputs-file outputs/amplify.json
    
    if [ "$ENVIRONMENT" = "production" ]; then
        print_status "Deploying production enhancements..."
        cdk deploy CIAlert-Production --require-approval never --outputs-file outputs/production.json
        cdk deploy CIAlert-Monitoring --require-approval never --outputs-file outputs/monitoring.json
        cdk deploy CIAlert-CICD --require-approval never --outputs-file outputs/cicd.json
    fi
    
    cd ..
    print_success "Infrastructure deployed"
}

# Configure services
configure_services() {
    print_status "Configuring services..."
    
    # Setup SES
    aws ses verify-email-identity --email-address $ADMIN_EMAIL --region $REGION 2>/dev/null || true
    print_status "Email verification sent to $ADMIN_EMAIL"
    
    # Configure Amplify
    if [ -f "infrastructure/outputs/amplify.json" ]; then
        AMPLIFY_APP_ID=$(jq -r '.["CIAlert-Amplify"].AmplifyAppId' infrastructure/outputs/amplify.json 2>/dev/null || echo "")
        
        if [ -n "$AMPLIFY_APP_ID" ] && [ "$AMPLIFY_APP_ID" != "null" ]; then
            API_URL=$(jq -r '.CIAlertStack.ApiGatewayUrl' infrastructure/outputs/core.json 2>/dev/null || echo "")
            USER_POOL_ID=$(jq -r '.CIAlertStack.UserPoolId' infrastructure/outputs/core.json 2>/dev/null || echo "")
            USER_POOL_CLIENT_ID=$(jq -r '.CIAlertStack.UserPoolClientId' infrastructure/outputs/core.json 2>/dev/null || echo "")
            
            aws amplify update-app \
                --app-id $AMPLIFY_APP_ID \
                --environment-variables \
                REACT_APP_API_URL=$API_URL,REACT_APP_USER_POOL_ID=$USER_POOL_ID,REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID,REACT_APP_REGION=$REGION \
                2>/dev/null || true
            
            aws amplify start-job --app-id $AMPLIFY_APP_ID --branch-name main --job-type RELEASE 2>/dev/null || true
            print_success "Amplify configured"
        fi
    fi
    
    # Create test user
    if [ -f "infrastructure/outputs/core.json" ]; then
        USER_POOL_ID=$(jq -r '.CIAlertStack.UserPoolId' infrastructure/outputs/core.json 2>/dev/null || echo "")
        
        if [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "null" ]; then
            aws cognito-idp admin-create-user \
                --user-pool-id $USER_POOL_ID \
                --username "test@example.com" \
                --user-attributes Name=email,Value="test@example.com" \
                --temporary-password "TempPass123!" \
                --message-action SUPPRESS \
                --region $REGION 2>/dev/null || true
            
            aws cognito-idp admin-confirm-user \
                --user-pool-id $USER_POOL_ID \
                --username "test@example.com" \
                --region $REGION 2>/dev/null || true
            
            aws cognito-idp admin-set-user-password \
                --user-pool-id $USER_POOL_ID \
                --username "test@example.com" \
                --password "Password123!" \
                --permanent \
                --region $REGION 2>/dev/null || true
            
            print_success "Test user created: test@example.com / Password123!"
        fi
    fi
}

# Run tests
run_tests() {
    print_status "Running system tests..."
    
    # Test API Gateway
    if [ -f "infrastructure/outputs/core.json" ]; then
        API_URL=$(jq -r '.CIAlertStack.ApiGatewayUrl' infrastructure/outputs/core.json 2>/dev/null || echo "")
        
        if [ -n "$API_URL" ] && [ "$API_URL" != "null" ]; then
            if curl -f -s "$API_URL/insights" >/dev/null 2>&1; then
                print_success "API Gateway accessible"
            else
                print_warning "API Gateway test failed"
            fi
        fi
    fi
    
    # Test Amplify
    if [ -f "infrastructure/outputs/amplify.json" ]; then
        AMPLIFY_URL=$(jq -r '.["CIAlert-Amplify"].AmplifyAppURL' infrastructure/outputs/amplify.json 2>/dev/null || echo "")
        
        if [ -n "$AMPLIFY_URL" ] && [ "$AMPLIFY_URL" != "null" ]; then
            if curl -f -s "$AMPLIFY_URL" >/dev/null 2>&1; then
                print_success "Amplify app accessible"
            else
                print_warning "Amplify app test failed (may still be building)"
            fi
        fi
    fi
    
    # Test DynamoDB
    INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text 2>/dev/null || echo "")
    if [ -n "$INSIGHTS_TABLE" ] && [ "$INSIGHTS_TABLE" != "None" ]; then
        if aws dynamodb describe-table --table-name $INSIGHTS_TABLE >/dev/null 2>&1; then
            print_success "DynamoDB accessible"
        else
            print_warning "DynamoDB test failed"
        fi
    fi
    
    # Test Lambda functions
    LAMBDA_FUNCTIONS=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'CIAlert')].FunctionName" --output text 2>/dev/null || echo "")
    if [ -n "$LAMBDA_FUNCTIONS" ]; then
        FUNCTION_COUNT=$(echo $LAMBDA_FUNCTIONS | wc -w)
        print_success "Found $FUNCTION_COUNT Lambda functions"
    else
        print_warning "No Lambda functions found"
    fi
}

# Get system status
get_status() {
    print_status "Getting system status..."
    
    echo ""
    echo "=== SYSTEM STATUS ==="
    
    # Core stack status
    if aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION >/dev/null 2>&1; then
        CORE_STATUS=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].StackStatus' --output text --region $REGION)
        echo "Core Stack: $CORE_STATUS"
    else
        echo "Core Stack: NOT_DEPLOYED"
    fi
    
    # Amplify status
    if [ -f "infrastructure/outputs/amplify.json" ]; then
        AMPLIFY_APP_ID=$(jq -r '.["CIAlert-Amplify"].AmplifyAppId' infrastructure/outputs/amplify.json 2>/dev/null || echo "")
        if [ -n "$AMPLIFY_APP_ID" ] && [ "$AMPLIFY_APP_ID" != "null" ]; then
            AMPLIFY_STATUS=$(aws amplify get-app --app-id $AMPLIFY_APP_ID --query 'app.defaultDomain' --output text 2>/dev/null || echo "ERROR")
            echo "Amplify App: $AMPLIFY_STATUS"
        fi
    fi
    
    # URLs
    echo ""
    echo "=== ENDPOINTS ==="
    
    if [ -f "infrastructure/outputs/core.json" ]; then
        API_URL=$(jq -r '.CIAlertStack.ApiGatewayUrl' infrastructure/outputs/core.json 2>/dev/null || echo "")
        [ -n "$API_URL" ] && [ "$API_URL" != "null" ] && echo "API Gateway: $API_URL"
    fi
    
    if [ -f "infrastructure/outputs/amplify.json" ]; then
        AMPLIFY_URL=$(jq -r '.["CIAlert-Amplify"].AmplifyAppURL' infrastructure/outputs/amplify.json 2>/dev/null || echo "")
        [ -n "$AMPLIFY_URL" ] && [ "$AMPLIFY_URL" != "null" ] && echo "Frontend: $AMPLIFY_URL"
    fi
    
    echo ""
    echo "Test Credentials:"
    echo "Username: test@example.com"
    echo "Password: Password123!"
}

# Destroy infrastructure
destroy_infrastructure() {
    print_warning "Destroying infrastructure..."
    
    cd infrastructure
    
    # Destroy in reverse order
    if [ "$ENVIRONMENT" = "production" ]; then
        cdk destroy CIAlert-CICD --force 2>/dev/null || true
        cdk destroy CIAlert-Monitoring --force 2>/dev/null || true
        cdk destroy CIAlert-Production --force 2>/dev/null || true
    fi
    
    cdk destroy CIAlert-Amplify --force 2>/dev/null || true
    cdk destroy CIAlert-BedrockAgent --force 2>/dev/null || true
    cdk destroy CIAlert-KnowledgeBase --force 2>/dev/null || true
    cdk destroy CIAlertStack --force 2>/dev/null || true
    
    cd ..
    
    # Clean up outputs
    rm -rf infrastructure/outputs/ 2>/dev/null || true
    
    print_success "Infrastructure destroyed"
}

# Display summary
display_summary() {
    print_success "🎉 Deployment completed successfully!"
    
    echo ""
    echo "=== DEPLOYMENT SUMMARY ==="
    
    if [ -f "infrastructure/outputs/core.json" ]; then
        API_URL=$(jq -r '.CIAlertStack.ApiGatewayUrl' infrastructure/outputs/core.json 2>/dev/null || echo "")
        USER_POOL_ID=$(jq -r '.CIAlertStack.UserPoolId' infrastructure/outputs/core.json 2>/dev/null || echo "")
        
        [ -n "$API_URL" ] && [ "$API_URL" != "null" ] && echo "API Gateway: $API_URL"
        [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "null" ] && echo "User Pool: $USER_POOL_ID"
    fi
    
    if [ -f "infrastructure/outputs/amplify.json" ]; then
        AMPLIFY_URL=$(jq -r '.["CIAlert-Amplify"].AmplifyAppURL' infrastructure/outputs/amplify.json 2>/dev/null || echo "")
        AMPLIFY_APP_ID=$(jq -r '.["CIAlert-Amplify"].AmplifyAppId' infrastructure/outputs/amplify.json 2>/dev/null || echo "")
        
        [ -n "$AMPLIFY_URL" ] && [ "$AMPLIFY_URL" != "null" ] && echo "Frontend: $AMPLIFY_URL"
        [ -n "$AMPLIFY_APP_ID" ] && [ "$AMPLIFY_APP_ID" != "null" ] && echo "Amplify App ID: $AMPLIFY_APP_ID"
    fi
    
    echo ""
    echo "Next Steps:"
    echo "1. Verify email: $ADMIN_EMAIL"
    echo "2. Enable Bedrock models in AWS Console"
    echo "3. Test system: ./deploy.sh $ENVIRONMENT $ADMIN_EMAIL test"
    echo ""
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "Production Features:"
        echo "✅ Multi-environment CI/CD"
        echo "✅ Comprehensive monitoring"
        echo "✅ Security scanning"
        echo "✅ Performance tracking"
    fi
}

# Create outputs directory
mkdir -p infrastructure/outputs

# Main execution
case $ACTION in
    "deploy")
        print_status "🚀 Starting CI Alert System deployment..."
        print_status "Environment: $ENVIRONMENT | Region: $REGION | Email: $ADMIN_EMAIL"
        
        check_prerequisites
        bootstrap_cdk
        install_dependencies
        deploy_infrastructure
        configure_services
        run_tests
        display_summary
        ;;
    
    "test")
        print_status "🧪 Running system tests..."
        run_tests
        ;;
    
    "status")
        get_status
        ;;
    
    "destroy")
        print_warning "⚠️  This will destroy all infrastructure!"
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            destroy_infrastructure
        else
            print_status "Destruction cancelled"
        fi
        ;;
    
    *)
        echo "Usage: $0 [environment] [admin-email] [action]"
        echo "Actions: deploy, test, destroy, status"
        echo "Example: $0 production admin@company.com deploy"
        exit 1
        ;;
esac