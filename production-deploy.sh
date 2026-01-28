#!/bin/bash

# Production-Grade Deployment Script for CI Alert System with Amplify
# Usage: ./production-deploy.sh [environment] [admin-email]

set -e

ENVIRONMENT=${1:-production}
ADMIN_EMAIL=${2:-admin@example.com}
REGION=${AWS_DEFAULT_REGION:-us-east-1}

echo "🚀 Starting Production-Grade Deployment for CI Alert System"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Admin Email: $ADMIN_EMAIL"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    # Check CDK
    if ! command -v cdk &> /dev/null; then
        print_error "AWS CDK not found. Please install AWS CDK."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js 18+."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not found. Some features may not work."
    fi
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure'."
        exit 1
    fi
    
    print_success "Prerequisites check completed"
}

# Bootstrap CDK if needed
bootstrap_cdk() {
    print_status "Checking CDK bootstrap..."
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION &> /dev/null; then
        print_status "Bootstrapping CDK for account $ACCOUNT_ID in region $REGION..."
        cdk bootstrap aws://$ACCOUNT_ID/$REGION
        print_success "CDK bootstrap completed"
    else
        print_success "CDK already bootstrapped"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Infrastructure dependencies
    cd infrastructure
    npm install
    cd ..
    
    # Frontend dependencies
    cd frontend
    npm install
    cd ..
    
    print_success "Dependencies installed"
}

# Deploy infrastructure stacks
deploy_infrastructure() {
    print_status "Deploying infrastructure stacks..."
    
    cd infrastructure
    
    # Set environment variables
    export ENVIRONMENT=$ENVIRONMENT
    export ADMIN_EMAIL=$ADMIN_EMAIL
    
    # Deploy stacks in order
    print_status "Deploying Core Stack..."
    cdk deploy CIAlertStack --require-approval never --outputs-file core-outputs.json
    
    print_status "Deploying Knowledge Base Stack..."
    cdk deploy CIAlert-KnowledgeBase --require-approval never --outputs-file kb-outputs.json
    
    print_status "Deploying Bedrock Agent Stack..."
    cdk deploy CIAlert-BedrockAgent --require-approval never --outputs-file agent-outputs.json
    
    print_status "Deploying Amplify Frontend Stack..."
    cdk deploy CIAlert-Amplify --require-approval never --outputs-file amplify-outputs.json
    
    if [ "$ENVIRONMENT" = "production" ]; then
        print_status "Deploying Production Enhancements..."
        cdk deploy CIAlert-Production --require-approval never --outputs-file production-outputs.json
        
        print_status "Deploying Monitoring Stack..."
        cdk deploy CIAlert-Monitoring --require-approval never --outputs-file monitoring-outputs.json
        
        print_status "Deploying CI/CD Pipeline..."
        cdk deploy CIAlert-CICD --require-approval never --outputs-file cicd-outputs.json
    fi
    
    cd ..
    print_success "Infrastructure deployment completed"
}

# Configure Amplify app
configure_amplify() {
    print_status "Configuring Amplify application..."
    
    # Get outputs from CDK
    if [ -f "infrastructure/amplify-outputs.json" ]; then
        AMPLIFY_APP_ID=$(jq -r '.["CIAlert-Amplify"].AmplifyAppId' infrastructure/amplify-outputs.json)
        API_URL=$(jq -r '.CIAlertStack.ApiGatewayUrl' infrastructure/core-outputs.json)
        USER_POOL_ID=$(jq -r '.CIAlertStack.UserPoolId' infrastructure/core-outputs.json)
        USER_POOL_CLIENT_ID=$(jq -r '.CIAlertStack.UserPoolClientId' infrastructure/core-outputs.json)
        
        print_status "Amplify App ID: $AMPLIFY_APP_ID"
        
        # Update environment variables
        aws amplify update-app \
            --app-id $AMPLIFY_APP_ID \
            --environment-variables \
            REACT_APP_API_URL=$API_URL,REACT_APP_USER_POOL_ID=$USER_POOL_ID,REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID,REACT_APP_REGION=$REGION
        
        # Start build
        print_status "Starting Amplify build..."
        aws amplify start-job --app-id $AMPLIFY_APP_ID --branch-name main --job-type RELEASE
        
        print_success "Amplify configuration completed"
    else
        print_warning "Amplify outputs not found, skipping configuration"
    fi
}

# Setup SES for email notifications
setup_ses() {
    print_status "Setting up SES for email notifications..."
    
    # Verify email address
    aws ses verify-email-identity --email-address $ADMIN_EMAIL --region $REGION || true
    
    print_status "Email verification sent to $ADMIN_EMAIL"
    print_warning "Please check your email and click the verification link"
}

# Create test user
create_test_user() {
    print_status "Creating test user..."
    
    if [ -f "infrastructure/core-outputs.json" ]; then
        USER_POOL_ID=$(jq -r '.CIAlertStack.UserPoolId' infrastructure/core-outputs.json)
        
        # Create test user
        aws cognito-idp admin-create-user \
            --user-pool-id $USER_POOL_ID \
            --username "test@example.com" \
            --user-attributes Name=email,Value="test@example.com" \
            --temporary-password "TempPass123!" \
            --message-action SUPPRESS \
            --region $REGION || true
        
        # Confirm user
        aws cognito-idp admin-confirm-user \
            --user-pool-id $USER_POOL_ID \
            --username "test@example.com" \
            --region $REGION || true
        
        # Set permanent password
        aws cognito-idp admin-set-user-password \
            --user-pool-id $USER_POOL_ID \
            --username "test@example.com" \
            --password "Password123!" \
            --permanent \
            --region $REGION || true
        
        print_success "Test user created: test@example.com / Password123!"
    fi
}

# Run system tests
run_tests() {
    print_status "Running system tests..."
    
    # Basic connectivity tests
    if [ -f "infrastructure/core-outputs.json" ]; then
        API_URL=$(jq -r '.CIAlertStack.ApiGatewayUrl' infrastructure/core-outputs.json)
        
        # Test API Gateway
        if curl -f -s "$API_URL/insights" > /dev/null; then
            print_success "API Gateway is accessible"
        else
            print_warning "API Gateway test failed"
        fi
    fi
    
    # Test Amplify app
    if [ -f "infrastructure/amplify-outputs.json" ]; then
        AMPLIFY_URL=$(jq -r '.["CIAlert-Amplify"].AmplifyAppURL' infrastructure/amplify-outputs.json)
        
        if curl -f -s "$AMPLIFY_URL" > /dev/null; then
            print_success "Amplify app is accessible"
        else
            print_warning "Amplify app test failed (may still be building)"
        fi
    fi
}

# Display deployment summary
display_summary() {
    print_success "🎉 Deployment completed successfully!"
    echo ""
    echo "=== DEPLOYMENT SUMMARY ==="
    
    if [ -f "infrastructure/core-outputs.json" ]; then
        API_URL=$(jq -r '.CIAlertStack.ApiGatewayUrl' infrastructure/core-outputs.json)
        USER_POOL_ID=$(jq -r '.CIAlertStack.UserPoolId' infrastructure/core-outputs.json)
        
        echo "API Gateway URL: $API_URL"
        echo "User Pool ID: $USER_POOL_ID"
    fi
    
    if [ -f "infrastructure/amplify-outputs.json" ]; then
        AMPLIFY_URL=$(jq -r '.["CIAlert-Amplify"].AmplifyAppURL' infrastructure/amplify-outputs.json)
        AMPLIFY_APP_ID=$(jq -r '.["CIAlert-Amplify"].AmplifyAppId' infrastructure/amplify-outputs.json)
        
        echo "Frontend URL: $AMPLIFY_URL"
        echo "Amplify App ID: $AMPLIFY_APP_ID"
    fi
    
    echo ""
    echo "Test Credentials:"
    echo "Username: test@example.com"
    echo "Password: Password123!"
    echo ""
    echo "Next Steps:"
    echo "1. Verify your email address: $ADMIN_EMAIL"
    echo "2. Enable Bedrock models in AWS Console"
    echo "3. Run: bash test.sh system"
    echo ""
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "Production Features Enabled:"
        echo "✅ Multi-environment CI/CD pipeline"
        echo "✅ Comprehensive monitoring and alerting"
        echo "✅ Security scanning and compliance"
        echo "✅ Performance baselines and SLA tracking"
        echo "✅ Disaster recovery and backup procedures"
    fi
}

# Main execution
main() {
    check_prerequisites
    bootstrap_cdk
    install_dependencies
    deploy_infrastructure
    configure_amplify
    setup_ses
    create_test_user
    run_tests
    display_summary
}

# Error handling
trap 'print_error "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"