#!/bin/bash

# Script to get all deployed URLs and endpoints

echo "🔍 Fetching deployed URLs..."
echo ""

REGION=$(aws configure get region || echo "us-east-1")

# Get CloudFront URL
echo "📡 CloudFront Distribution:"
CLOUDFRONT_ID=$(aws cloudfront list-distributions --query 'DistributionList.Items[?Comment==`CI Alert Distribution`].Id' --output text 2>/dev/null)
if [ -n "$CLOUDFRONT_ID" ]; then
    CLOUDFRONT_URL=$(aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.DomainName' --output text 2>/dev/null)
    echo "  https://$CLOUDFRONT_URL"
else
    echo "  Not found - Check stack: CIAlert-Frontend"
fi

# Get ALB URL
echo ""
echo "🔗 Application Load Balancer:"
ALB_DNS=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `ci-alert`)].DNSName' --output text 2>/dev/null)
if [ -n "$ALB_DNS" ]; then
    echo "  http://$ALB_DNS"
else
    echo "  Not found"
fi

# Get API Gateway URL
echo ""
echo "🌐 API Gateway:"
API_ID=$(aws apigateway get-rest-apis --query 'items[?name==`ci-alert-api`].id' --output text 2>/dev/null)
if [ -n "$API_ID" ]; then
    echo "  https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod"
else
    echo "  Not found - Check stack: CIAlert-API"
fi

# Get Cognito User Pool
echo ""
echo "🔐 Cognito User Pool:"
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --query 'UserPools[?Name==`ci-alert-users`].Id' --output text 2>/dev/null)
if [ -n "$USER_POOL_ID" ]; then
    echo "  Pool ID: $USER_POOL_ID"
    CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id $USER_POOL_ID --query 'UserPoolClients[0].ClientId' --output text 2>/dev/null)
    echo "  Client ID: $CLIENT_ID"
else
    echo "  Not found - Check stack: CIAlert-Auth"
fi

# Get DynamoDB Tables
echo ""
echo "📊 DynamoDB Tables:"
for table in ci-alert-insights ci-alert-user-settings ci-alert-watchlist; do
    if aws dynamodb describe-table --table-name $table &>/dev/null; then
        echo "  ✓ $table"
    else
        echo "  ✗ $table (not found)"
    fi
done

# Get S3 Bucket
echo ""
echo "🪣 S3 Data Bucket:"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="ci-alert-data-${ACCOUNT_ID}-${REGION}"
if aws s3 ls s3://$BUCKET &>/dev/null; then
    echo "  s3://$BUCKET"
else
    echo "  Not found"
fi

# Get Lambda Functions
echo ""
echo "⚡ Lambda Functions:"
for func in ci-alert-pubmed-ingestion ci-alert-processor ci-alert-daily-digest; do
    if aws lambda get-function --function-name $func &>/dev/null; then
        echo "  ✓ $func"
    else
        echo "  ✗ $func (not found)"
    fi
done

echo ""
echo "💡 If CloudFront not found, check if frontend stack deployed:"
echo "   aws cloudformation describe-stacks --stack-name CIAlert-Frontend"