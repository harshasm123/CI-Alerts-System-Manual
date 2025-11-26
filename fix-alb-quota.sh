#!/bin/bash

# Fix ALB Service Quota Issue

echo "🔧 Checking ALB Service Quotas..."
echo ""

REGION=$(aws configure get region)

# Check current ALB quota
echo "Current ALB quotas in $REGION:"
aws service-quotas list-service-quotas \
  --service-code elasticloadbalancing \
  --region $REGION \
  --query 'Quotas[?contains(QuotaName, `Application Load Balancers`)].{Name:QuotaName,Value:Value,Used:UsageMetric.MetricDimensions}' \
  --output table 2>/dev/null || echo "Unable to fetch quotas"

echo ""
echo "📋 Manual Steps to Fix:"
echo ""
echo "1. Open AWS Console: https://console.aws.amazon.com/servicequotas/"
echo "2. Search for 'Elastic Load Balancing'"
echo "3. Find 'Application Load Balancers per Region'"
echo "4. Click 'Request quota increase'"
echo "5. Enter new value: 20 (or higher)"
echo "6. Submit request"
echo ""
echo "⏱️  Approval usually takes 15-30 minutes"
echo ""
echo "Alternative: Deploy without Frontend stack (no ALB needed)"
echo "   Run: cdk deploy CIAlertStack CIAlert-Monitoring CIAlert-CICD"
