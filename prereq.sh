#!/bin/bash

# Prerequisites Installation Script for CI Alert System
# Installs Node.js, AWS CLI, CDK, and other required tools

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

print_status "🔧 Installing CI Alert System Prerequisites"

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
else
    print_warning "Unknown OS: $OSTYPE"
    OS="linux"
fi

print_status "Detected OS: $OS"

# Install Node.js
install_nodejs() {
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js already installed: $NODE_VERSION"
    else
        print_status "Installing Node.js..."
        
        if [ "$OS" = "linux" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif [ "$OS" = "macos" ]; then
            if command -v brew >/dev/null 2>&1; then
                brew install node
            else
                print_warning "Please install Homebrew first or download Node.js from nodejs.org"
                return 1
            fi
        elif [ "$OS" = "windows" ]; then
            print_warning "Please download Node.js from https://nodejs.org/"
            return 1
        fi
        
        print_success "Node.js installed"
    fi
}

# Install AWS CLI
install_aws_cli() {
    if command -v aws >/dev/null 2>&1; then
        AWS_VERSION=$(aws --version)
        print_success "AWS CLI already installed: $AWS_VERSION"
    else
        print_status "Installing AWS CLI..."
        
        if [ "$OS" = "linux" ]; then
            curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
            unzip awscliv2.zip
            sudo ./aws/install
            rm -rf awscliv2.zip aws/
        elif [ "$OS" = "macos" ]; then
            curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
            sudo installer -pkg AWSCLIV2.pkg -target /
            rm AWSCLIV2.pkg
        elif [ "$OS" = "windows" ]; then
            print_warning "Please download AWS CLI from https://aws.amazon.com/cli/"
            return 1
        fi
        
        print_success "AWS CLI installed"
    fi
}

# Install AWS CDK
install_cdk() {
    if command -v cdk >/dev/null 2>&1; then
        CDK_VERSION=$(cdk --version)
        print_success "AWS CDK already installed: $CDK_VERSION"
    else
        print_status "Installing AWS CDK..."
        npm install -g aws-cdk
        print_success "AWS CDK installed"
    fi
}

# Install jq
install_jq() {
    if command -v jq >/dev/null 2>&1; then
        JQ_VERSION=$(jq --version)
        print_success "jq already installed: $JQ_VERSION"
    else
        print_status "Installing jq..."
        
        if [ "$OS" = "linux" ]; then
            sudo apt-get update && sudo apt-get install -y jq
        elif [ "$OS" = "macos" ]; then
            if command -v brew >/dev/null 2>&1; then
                brew install jq
            else
                print_warning "Please install Homebrew first"
                return 1
            fi
        elif [ "$OS" = "windows" ]; then
            print_warning "Please install jq from https://stedolan.github.io/jq/"
            return 1
        fi
        
        print_success "jq installed"
    fi
}

# Install Docker (optional)
install_docker() {
    if command -v docker >/dev/null 2>&1; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker already installed: $DOCKER_VERSION"
    else
        print_status "Installing Docker..."
        
        if [ "$OS" = "linux" ]; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo usermod -aG docker $USER
            rm get-docker.sh
            print_warning "Please log out and back in to use Docker without sudo"
        elif [ "$OS" = "macos" ]; then
            print_warning "Please download Docker Desktop from https://www.docker.com/products/docker-desktop"
        elif [ "$OS" = "windows" ]; then
            print_warning "Please download Docker Desktop from https://www.docker.com/products/docker-desktop"
        fi
        
        print_success "Docker installation initiated"
    fi
}

# Main installation
main() {
    install_nodejs
    install_aws_cli
    install_cdk
    install_jq
    install_docker
    
    print_success "🎉 Prerequisites installation completed!"
    echo ""
    echo "Next steps:"
    echo "1. Configure AWS credentials: aws configure"
    echo "2. Deploy the system: ./deploy.sh production your-email@company.com"
    echo ""
    echo "Required AWS permissions:"
    echo "- CloudFormation, Lambda, DynamoDB, API Gateway"
    echo "- Cognito, S3, OpenSearch, Bedrock, Amplify"
    echo "- IAM, CloudWatch, SES, EventBridge, SQS"
}

# Run installation
main