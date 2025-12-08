#!/bin/bash

# Fix TypeScript compilation errors
# This solves the "Cannot find name 'cloudfront'" errors

echo "🔧 Fixing TypeScript compilation..."
cd infrastructure

echo "📦 Step 1: Cleaning old modules..."
rm -rf node_modules dist *.tsbuildinfo package-lock.json 2>/dev/null || true

echo "📥 Step 2: Installing dependencies..."
npm install

echo "🔨 Step 3: Rebuilding TypeScript..."
npm run build

echo "✅ Build complete! Ready to deploy."
echo ""
echo "Next step:"
echo "AWS_REGION=us-west-2 cdk deploy CIAlert-Frontend --require-approval never"
