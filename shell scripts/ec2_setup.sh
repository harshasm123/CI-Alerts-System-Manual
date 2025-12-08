#!/bin/bash

# EC2 Ubuntu Setup Script for CI Alert System
# Run this on your EC2 Ubuntu instance

set -e

echo "🚀 Setting up CI Alert System on EC2 Ubuntu"

echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get upgrade -y

# Install Git
echo "📦 Installing Git..."
sudo apt-get install -y git

# Clone repository
echo "📥 Cloning repository..."
cd ~
if [ -d "CI-Alerts-System-Manual" ]; then
    echo "Repository already exists. Pulling latest changes..."
    cd CI-Alerts-System-Manual
    git pull origin main
else
    git clone https://github.com/harshasm123/CI-Alerts-System-Manual.git
    cd CI-Alerts-System-Manual
fi

# Install prerequisites
echo "🔧 Installing prerequisites..."

# Install unzip first
sudo apt-get install -y unzip

# AWS CLI
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi

# Node.js 20 (LTS)
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

# Python 3 (use system default)
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip python3-venv

# Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    sudo systemctl start docker
    sudo chmod 666 /var/run/docker.sock
    rm get-docker.sh
    echo "🐳 Docker installed and permissions fixed"
fi

# AWS CDK
sudo npm install -g aws-cdk

# Configure AWS credentials
echo "🔐 Configure AWS credentials..."
aws configure

echo "✅ EC2 setup complete!"
echo "📍 Repository location: ~/CI-Alerts-System-Manual"
echo ""
echo "Python version: $(python3 --version)"
echo "Node version: $(node --version)"
echo "Docker version: $(docker --version)"
echo ""
echo "Next steps:"
echo "1. Enable Bedrock models in AWS Console"
echo "2. cd ~/CI-Alerts-System-Manual"
echo "3. Run deployment: ./deploy.sh"