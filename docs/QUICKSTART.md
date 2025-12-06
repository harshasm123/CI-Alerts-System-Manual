# CI Alert System - Complete Deployment Guide

## Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install AWS CDK
npm install -g aws-cdk

# Install Python
sudo apt-get install -y python3-pip
pip3 install boto3

# Configure AWS
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output (json)
```

---

## Step 1: Bootstrap CDK

```bash
bash check-bootstrap.sh
cd infrastructure
cdk bootstrap
cd ..
```

---

## Step 2: Deploy Infrastructure

```bash
bash deploy.sh
```

**Deploys 6 stacks (~12-15 minutes):**
1. CIAlertStack - Core (DynamoDB, Lambda, API Gateway, Cognito, SQS, EventBridge)
2. CIAlert-KnowledgeBase - S3 + OpenSearch Serverless + Bedrock KB
3. CIAlert-BedrockAgent - Bedrock Agent + RAG actions
4. CIAlert-Frontend - S3 + CloudFront
5. CIAlert-Monitoring - CloudWatch
6. CIAlert-CICD - CodePipeline (optional)

---

## Step 3: Setup SES Email

```bash
bash setup-ses.sh
```

Enter your email address and verify it by clicking the link in your inbox.

---

## Step 4: Enable Bedrock Models

```bash
echo "Enable these models in AWS Console:"
echo "1. Go to: https://console.aws.amazon.com/bedrock/home#/modelaccess"
echo "2. Enable: Claude 3.5 Sonnet v2"
echo "3. Enable: Claude 3.5 Haiku"
echo "4. Enable: Titan Text Embeddings v1"
echo "5. Wait for 'Access granted' status"
```

**Required for:**
- Claude 3.5 Haiku: Batch processing (cost-effective)
- Claude 3.5 Sonnet v2: Interactive agent queries
- Titan Embeddings: Vector search in knowledge base

---

## Step 5: Upload Sample Data

```bash
bash upload-sample-data.sh
```

**This will:**
- Create sample pharmaceutical documents
- Upload to knowledge base S3 bucket
- Start Bedrock ingestion job
- Enable RAG search capabilities

---

## Step 6: Deploy Frontend

```bash
bash deploy-cognito-frontend.sh
```

**This will (~3-5 minutes):**
- Get Cognito config from stack outputs
- Build React app with AWS Amplify
- Upload to S3
- Invalidate CloudFront cache

---

## Step 7: Create Test User

```bash
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)

# Sign up
aws cognito-idp sign-up \
  --client-id $USER_POOL_CLIENT_ID \
  --username test@example.com \
  --password Test123! \
  --user-attributes Name=email,Value=test@example.com

# Confirm (skip email verification)
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com
```

---

## Step 8: Add User Email for Digests

```bash
SETTINGS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'UserSettings')]|[0]" --output text)

aws dynamodb put-item \
  --table-name $SETTINGS_TABLE \
  --item '{
    "userId":{"S":"test@example.com"},
    "email":{"S":"YOUR_VERIFIED_EMAIL"},
    "digestEnabled":{"BOOL":true}
  }'
```

Replace `YOUR_VERIFIED_EMAIL` with the email you verified in Step 3.

---

## Step 9: Trigger Test Ingestion

```bash
bash test.sh ingestion
```

This creates test insights for Keytruda and Opdivo.

---

## Step 10: Test Daily Digest

```bash
bash test.sh digest
```

Check your email for the digest.

---

## Step 11: Access Frontend

```bash
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text)
echo "Frontend: $CLOUDFRONT_URL"
```

**Login with:**
- Email: `test@example.com`
- Password: `Test123!`

**Test Features:**
- Dashboard: View insights overview
- AI Assistant: Chat with Bedrock Agent (try "Search for Keytruda FDA approval")
- Watchlist: Add/remove molecules
- Insights: Browse all insights with search
- Settings: Configure email preferences

---

## Testing

### Test Cognito Configuration
```bash
bash test.sh cognito
```

### Test Full System
```bash
bash test.sh system
```

### Test API Endpoints
```bash
bash test.sh api
```

### Test RAG Knowledge Base
```bash
# Check knowledge base status
KB_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
aws bedrock-agent list-ingestion-jobs --knowledge-base-id $KB_ID

# Test agent with RAG
echo "Try asking the AI Assistant: 'Search for FDA approval documents'"
```

---

## Troubleshooting

### Issue: Frontend shows 401 Unauthorized

**Solution:**
```bash
# Confirm user
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com

# Or sign out and sign in again in the UI
```

### Issue: No insights in UI

**Solution:**
```bash
# 1. Check Bedrock model access
echo "Verify Claude 3.5 Haiku enabled in Bedrock console"

# 2. Trigger ingestion
bash test.sh ingestion

# 3. Wait for processing
sleep 30

# 4. Check insights table
INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text)
aws dynamodb scan --table-name $INSIGHTS_TABLE --max-items 5

# 5. Check processor logs
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --since 10m
```

### Issue: No email digest received

**Solution:**
```bash
# 1. Verify SES email
bash setup-ses.sh

# 2. Check email in UserSettings table
SETTINGS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'UserSettings')]|[0]" --output text)
aws dynamodb scan --table-name $SETTINGS_TABLE

# 3. Test digest manually
bash test.sh digest

# 4. Check digest logs
aws logs tail /aws/lambda/CIAlertStack-DigestFunction --since 10m
```

### Issue: Frontend not loading

**Solution:**
```bash
# Invalidate CloudFront cache
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"

# Wait 2-3 minutes for invalidation
```

### Issue: Bootstrap fails

**Solution:**
```bash
# Switch to supported region
export AWS_REGION=us-east-1
aws configure set region us-east-1

# Clean and re-bootstrap
bash fix-rollback.sh
cd infrastructure
cdk bootstrap
cd ..
```

### Issue: Agent chat not working

**Solution:**
```bash
# 1. Check agent status
AGENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-BedrockAgent --query 'Stacks[0].Outputs[?OutputKey==`AgentIdOutput`].OutputValue' --output text)
aws bedrock-agent get-agent --agent-id $AGENT_ID

# 2. Prepare agent if needed
aws bedrock-agent prepare-agent --agent-id $AGENT_ID

# 3. Check knowledge base connection
bash connect-knowledge-base.sh
```

### Issue: Knowledge base search returns no results

**Solution:**
```bash
# 1. Check ingestion job status
KB_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
aws bedrock-agent list-ingestion-jobs --knowledge-base-id $KB_ID

# 2. Re-upload sample data
bash upload-sample-data.sh

# 3. Check OpenSearch collection
aws opensearchserverless list-collections --collection-filters name=ci-alert-vectors
```

---

## Daily Operations

### View Logs
```bash
# PubMed ingestion
aws logs tail /aws/lambda/CIAlertStack-PubMedFunction --follow

# Processor
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --follow

# Digest
aws logs tail /aws/lambda/CIAlertStack-DigestFunction --follow
```

### Check EventBridge Rules
```bash
# List all rules
aws events list-rules

# Check ingestion rule (midnight UTC)
aws events describe-rule --name CIAlertStack-DailyIngestionRule

# Check digest rule (9 AM UTC)
aws events describe-rule --name CIAlertStack-DailyDigestRule
```

### Monitor CloudWatch Dashboard
```bash
# Get dashboard URL
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:"
```

---

## Cleanup

```bash
# Use destroy script (handles dependencies)
bash destroy.sh

# Or manually in reverse order
aws cloudformation delete-stack --stack-name CIAlert-CICD
aws cloudformation delete-stack --stack-name CIAlert-Monitoring
aws cloudformation delete-stack --stack-name CIAlert-Frontend
aws cloudformation delete-stack --stack-name CIAlert-BedrockAgent
aws cloudformation delete-stack --stack-name CIAlert-KnowledgeBase
aws cloudformation delete-stack --stack-name CIAlertStack

# Wait for completion
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack
```

---

## Success Checklist

- [ ] All 6 stacks deployed successfully
- [ ] Bedrock models enabled (Claude 3.5 Sonnet v2, Haiku, Titan Embeddings)
- [ ] Knowledge base documents uploaded and ingested
- [ ] SES email verified
- [ ] Frontend accessible via CloudFront URL
- [ ] User can sign in with Cognito
- [ ] AI Assistant chat works with RAG search
- [ ] Watchlist CRUD operations work
- [ ] Insights visible in UI with AI summaries
- [ ] Test email digest received with AI summary
- [ ] CloudWatch dashboard shows metrics
- [ ] EventBridge rules active

---

## Next Steps

1. **Add More Molecules** - Use the UI to add molecules to your watchlist
2. **Upload Real Documents** - Add FDA approvals, clinical trials, patents to knowledge base
3. **Customize AI Prompts** - Edit prompts in `lambdas/processing/processor.py`
4. **Add Data Sources** - Integrate FDA, EMA, WIPO APIs
5. **Custom Domain** - Set up Route53 and ACM certificate
6. **Production Email** - Move SES out of sandbox mode
7. **Advanced RAG** - Add more document types and metadata
8. **Monitoring Alerts** - Configure SNS for CloudWatch alarms

---

## Cost Optimization Tips

- **Models**: 2-model approach saves $13.50/month vs single Sonnet
- **OpenSearch**: Serverless saves $35/month vs managed service
- **S3**: Use lifecycle policies for old documents
- **DynamoDB**: On-demand pricing for variable workloads
- **Lambda**: Reserved concurrency for predictable costs
- **Logs**: Set CloudWatch retention to 7 days
- **Monitoring**: Use AWS Cost Explorer and budgets

---

## Security Best Practices

- ✅ Rotate AWS credentials regularly
- ✅ Enable MFA on AWS account
- ✅ Use AWS Secrets Manager for sensitive data
- ✅ Review IAM policies quarterly
- ✅ Enable CloudTrail for audit logs
- ✅ Use VPC endpoints for private connectivity

---

## Support

For issues:
1. Check logs: `aws logs tail /aws/lambda/FUNCTION_NAME --follow`
2. Run system test: `bash test-system.sh`
3. Review CloudWatch dashboard
4. Check this troubleshooting section
5. Review [README.md](README.md) for architecture details
