#!/bin/bash
set -e

echo "🚀 Deploying all changes..."

# 1. Deploy backend with new ingestion sources
echo ""
echo "📦 Step 1: Deploying backend stack..."
cd ~/CI-Alerts-System-Manual/infrastructure
npx cdk deploy CIAlertStack --require-approval never --region us-west-2

# 2. Wait for deployment
echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 10

# 3. Sync frontend with backend
echo ""
echo "🔄 Step 2: Syncing frontend configuration..."
cd ~/CI-Alerts-System-Manual
chmod +x sync-and-deploy.sh
./sync-and-deploy.sh

echo ""
echo "✅ All changes deployed successfully!"
echo ""
echo "🎉 New features:"
echo "   • PubMed ingestion ✓"
echo "   • ClinicalTrials.gov ingestion ✓"
echo "   • FDA ingestion ✓"
echo "   • On-demand ingestion when adding molecules ✓"
echo "   • Fixed settings save (Decimal conversion) ✓"
echo "   • Formatted insights display ✓"
echo ""
echo "🌐 Access your app:"
ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region us-west-2 --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' --output text)
echo "   $ALB_URL"
echo ""
echo "🧪 Test by adding a new molecule - it will fetch from all 3 sources!"
