#!/bin/bash

# Fix Docker permissions and CDK deployment issues

echo "🔧 Fixing Docker permissions..."

# Add user to docker group
sudo usermod -aG docker $USER

# Start docker service
sudo systemctl start docker
sudo systemctl enable docker

# Fix permissions
sudo chmod 666 /var/run/docker.sock

echo "🐳 Testing Docker..."
docker --version

echo "🚀 Redeploying with fixed Docker..."
cd ~/CI-Alerts-System-Manual

# Clean CDK cache
rm -rf infrastructure/cdk.out
rm -rf infrastructure/node_modules/.cache

# Redeploy
bash deploy.sh

echo "✅ Docker fixed and deployment restarted"