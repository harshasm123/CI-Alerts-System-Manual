#!/bin/bash

# Debug deployment issues

echo "🔍 Debugging deployment..."

cd infrastructure

echo "📋 Environment:"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"
echo "CDK: $(cdk --version)"
echo "Region: $(aws configure get region)"

echo ""
echo "🧹 Cleaning build cache..."
rm -rf node_modules/.cache
rm -rf cdk.out
rm -rf dist

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building TypeScript..."
npm run build

echo ""
echo "🚀 Testing CDK synth..."
cdk synth CIAlertStack

echo ""
echo "✅ Debug complete. Try deployment again."