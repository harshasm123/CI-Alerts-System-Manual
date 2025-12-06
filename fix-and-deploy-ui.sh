#!/bin/bash
set -e

echo "🔧 Fixing and Deploying UI with ALB..."
echo ""

# Fix frontend package-lock.json
echo "📦 Fixing frontend dependencies..."
cd frontend
rm -f package-lock.json
npm install
cd ..

echo "✅ Frontend dependencies fixed"
echo ""

# Deploy the ALB frontend stack
echo "🚀 Deploying ALB Frontend Stack..."
cd infrastructure
npm run build
cdk deploy CIAlert-Frontend --require-approval never
cd ..

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Getting ALB URL..."
ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' --output text 2>/dev/null || echo "")

if [ -n "$ALB_URL" ]; then
    echo "✅ Your UI is available at: $ALB_URL"
else
    echo "⚠️  ALB URL not found in outputs. Check CloudFormation console."
fi

echo ""
echo "📝 Note: It may take 2-3 minutes for the ALB to become healthy"
echo "   If you get 503 errors, wait a bit and refresh"
