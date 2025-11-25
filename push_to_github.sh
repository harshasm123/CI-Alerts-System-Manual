#!/bin/bash

# CI Alert System - GitHub Push Script
# Repository: https://github.com/harshasm123/CI-Alerts-System-Manual.git

set -e

REPO_URL="https://github.com/harshasm123/CI-Alerts-System-Manual.git"
PROJECT_DIR="C:/Users/User/Documents/CI Alert System"

cd "$PROJECT_DIR"

echo "🚀 Pushing CI Alert System to GitHub"

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git branch -M main
fi

# Add remote if not exists
if ! git remote | grep -q origin; then
    echo "🔗 Adding remote origin..."
    git remote add origin "$REPO_URL"
else
    echo "✓ Remote origin already exists"
    git remote set-url origin "$REPO_URL"
fi

# Create .gitignore if not exists
if [ ! -f ".gitignore" ]; then
    echo "📝 Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# CDK
cdk.out/
.cdk.staging/

# Environment
.env
.env.local
*.pem
*.key

# AWS
.aws/
aws-exports.js

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
*.zip

# Logs
*.log
npm-debug.log*
EOF
fi

# Stage all files
echo "📂 Staging files..."
git add .

# Commit changes
echo "💾 Committing changes..."
COMMIT_MSG="${1:-Initial commit: CI Alert System for Healthcare Competitive Intelligence}"
git commit -m "$COMMIT_MSG" || echo "No changes to commit"

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
echo "Enter your GitHub Personal Access Token:"
read -s GITHUB_TOKEN

git push https://${GITHUB_TOKEN}@github.com/harshasm123/CI-Alerts-System-Manual.git main

echo "✅ Successfully pushed to GitHub!"
echo "🔗 Repository: $REPO_URL"