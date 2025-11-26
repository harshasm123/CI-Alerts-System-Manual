#!/bin/bash

# Prerequisites Setup Script for CI Alert System
set -e

echo "🔧 Setting up prerequisites for CI Alert System..."

# Check OS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "❌ Windows detected. Please use WSL or Linux/macOS"
    exit 1
fi

# Install unzip if not present
if ! command -v unzip &> /dev/null; then
    echo "📦 Installing unzip..."
    sudo apt-get update
    sudo apt-get install -y unzip
fi

# Install AWS CLI v2
if ! command -v aws &> /dev/null; then
    echo "📦 Installing AWS CLI v2..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi

# Install Node.js 18
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | cut -d'v' -f2) -lt 18 ]]; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Python 3 (use system default)
if ! command -v python3 &> /dev/null; then
    echo "📦 Installing Python 3..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv
else
    echo "✓ Python 3 already installed: $(python3 --version)"
fi

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Install AWS CDK
if ! command -v cdk &> /dev/null; then
    echo "📦 Installing AWS CDK..."
    sudo npm install -g aws-cdk
fi

# Configure AWS CLI
echo "🔐 Configuring AWS CLI..."
if [ ! -f ~/.aws/credentials ]; then
    echo "Please enter your AWS credentials:"
    aws configure
else
    echo "AWS credentials already configured. Reconfigure? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        aws configure
    fi
fi

# Check and fix region for CloudFormation hook issues
CURRENT_REGION=$(aws configure get region)
echo "🌍 Current region: $CURRENT_REGION"

if [ "$CURRENT_REGION" = "us-west-2" ]; then
    echo "⚠️  WARNING: us-west-2 has CloudFormation hooks that block CDK bootstrap"
    echo "   Switching to us-east-1 to avoid AWS::EarlyValidation::ResourceExistenceCheck"
    aws configure set region us-east-1
    echo "✅ Region changed to us-east-1"
fi

# Verify AWS access
echo "🔍 Verifying AWS access..."
aws sts get-caller-identity

echo "⚠️  IMPORTANT: Enable Bedrock models manually"
echo "   1. Go to AWS Console > Bedrock > Model Access"
echo "   2. Request access to: Claude 3 Sonnet and Titan Embeddings"
echo "   3. Wait for approval (usually instant for standard models)"

echo "✅ Prerequisites setup complete!"
echo ""
echo "Next steps:"
echo "1. Enable Bedrock models: https://console.aws.amazon.com/bedrock/home#/modelaccess"
echo "2. Run: ./deploy.sh"