#!/bin/bash

# Script to get all deployed URLs and endpoints

echo "🔍 Fetching deployed resources..."
echo ""

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
    echo "⚠️  No region configured. Defaulting to $REGION"
fi

echo "🌍 Region: $REGION"
echo ""

# Core Stack
echo "=== CIAlertStack ==="
if aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION &>/dev/null; then
    API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null)
    USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null)
    USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null)
    DATA_BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text 2>/dev/null)
    
    [ -n "$API_URL" ] && echo "  🌐 API Gateway: $API_URL"
    [ -n "$USER_POOL_ID" ] && echo "  🔐 User Pool ID: $USER_POOL_ID"
    [ -n "$USER_POOL_CLIENT_ID" ] && echo "  🔑 Client ID: $USER_POOL_CLIENT_ID"
    [ -n "$DATA_BUCKET" ] && echo "  🪣 S3 Bucket: s3://$DATA_BUCKET"
else
    echo "  ❌ Not deployed"
fi

echo ""
echo "=== CIAlert-Frontend ==="
if aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION &>/dev/null; then
    CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text 2>/dev/null)
    ALB_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ALBURL`].OutputValue' --output text 2>/dev/null)
    ECR_REPO=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ECRRepository`].OutputValue' --output text 2>/dev/null)
    
    [ -n "$CLOUDFRONT_URL" ] && echo "  🔗 CloudFront: $CLOUDFRONT_URL"
    [ -n "$ALB_URL" ] && echo "  ⚖️ ALB: $ALB_URL"
    [ -n "$ECR_REPO" ] && echo "  📦 ECR: $ECR_REPO"
else
    echo "  ❌ Not deployed"
fi

echo ""
echo "=== CIAlert-Monitoring ==="
if aws cloudformation describe-stacks --stack-name CIAlert-Monitoring --region $REGION &>/dev/null; then
    DASHBOARD_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Monitoring --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`DashboardURL`].OutputValue' --output text 2>/dev/null)
    ALERT_TOPIC=$(aws cloudformation describe-stacks --stack-name CIAlert-Monitoring --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`AlertTopicArn`].OutputValue' --output text 2>/dev/null)
    
    [ -n "$DASHBOARD_URL" ] && echo "  📊 Dashboard: $DASHBOARD_URL"
    [ -n "$ALERT_TOPIC" ] && echo "  🔔 Alerts: $ALERT_TOPIC"
else
    echo "  ❌ Not deployed"
fi

echo ""
echo "=== CIAlert-KnowledgeBase ==="
if aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --region $REGION &>/dev/null; then
    KB_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null)
    KB_BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`DataSourceBucket`].OutputValue' --output text 2>/dev/null)
    
    [ -n "$KB_ID" ] && echo "  📚 Knowledge Base ID: $KB_ID"
    [ -n "$KB_BUCKET" ] && echo "  🪣 KB Bucket: s3://$KB_BUCKET"
else
    echo "  ❌ Not deployed"
fi

echo ""
echo "=== CIAlert-BedrockAgent ==="
if aws cloudformation describe-stacks --stack-name CIAlert-BedrockAgent --region $REGION &>/dev/null; then
    AGENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-BedrockAgent --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`AgentIdOutput`].OutputValue' --output text 2>/dev/null)
    AGENT_ALIAS_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-BedrockAgent --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`AgentAliasIdOutput`].OutputValue' --output text 2>/dev/null)
    
    [ -n "$AGENT_ID" ] && echo "  🤖 Agent ID: $AGENT_ID"
    [ -n "$AGENT_ALIAS_ID" ] && echo "  🎯 Alias ID: $AGENT_ALIAS_ID"
else
    echo "  ❌ Not deployed"
fi

echo ""
echo "=== CIAlert-CICD ==="
if aws cloudformation describe-stacks --stack-name CIAlert-CICD --region $REGION &>/dev/null; then
    REPO_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-CICD --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`RepositoryCloneUrl`].OutputValue' --output text 2>/dev/null)
    PIPELINE_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-CICD --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`PipelineUrl`].OutputValue' --output text 2>/dev/null)
    
    [ -n "$REPO_URL" ] && echo "  💻 CodeCommit: $REPO_URL"
    [ -n "$PIPELINE_URL" ] && echo "  🔄 Pipeline: $PIPELINE_URL"
else
    echo "  ❌ Not deployed"
fi

echo ""
echo "📊 DynamoDB Tables:"
for table in $(aws dynamodb list-tables --region $REGION --query 'TableNames[?contains(@, `CIAlertStack`)]' --output text); do
    echo "  ✓ $table"
done

echo ""
echo "⚡ Lambda Functions:"
for func in $(aws lambda list-functions --region $REGION --query 'Functions[?contains(FunctionName, `CIAlertStack`)].FunctionName' --output text); do
    echo "  ✓ $func"
done

echo ""
echo "=== Test Commands ==="
if [ -n "$API_URL" ]; then
    echo "# Get insights"
    echo "curl ${API_URL}insights"
    echo ""
    echo "# Add to watchlist"
    echo "curl -X POST ${API_URL}watchlist -H 'Content-Type: application/json' -d '{\"userId\":\"test\",\"molecule\":\"Keytruda\"}'"
    echo ""
    echo "# Trigger PubMed ingestion"
    PUBMED_FUNC=$(aws lambda list-functions --region $REGION --query 'Functions[?contains(FunctionName, `PubMed`)].FunctionName' --output text 2>/dev/null)
    [ -n "$PUBMED_FUNC" ] && echo "aws lambda invoke --function-name $PUBMED_FUNC --region $REGION response.json"
else
    echo "Deploy CIAlertStack first: ./deploy.sh"
fi