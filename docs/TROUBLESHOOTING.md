# CI Alert System - Troubleshooting Guide

## Quick Diagnostics

```bash
# Run full system test
bash test.sh system

# Check all components
bash test.sh cognito    # Authentication
bash test.sh ingestion  # Data ingestion
bash test.sh digest     # Email alerts
bash test.sh api        # API endpoints
bash test.sh rag        # RAG knowledge base
```

---

## Common Issues

### 1. CDK Bootstrap Failures

#### Issue: `AWS::EarlyValidation::ResourceExistenceCheck` error
**Cause:** CloudFormation hooks in us-west-2 blocking VPC/ALB creation

**Solution:**
```bash
# Switch to us-east-1
export AWS_REGION=us-east-1
aws configure set region us-east-1

# Re-bootstrap
cd infrastructure
cdk bootstrap
cd ..
```

#### Issue: CDKToolkit in ROLLBACK_COMPLETE state
**Cause:** Previous bootstrap failed

**Solution:**
```bash
# Delete failed stack
aws cloudformation delete-stack --stack-name CDKToolkit
aws cloudformation wait stack-delete-complete --stack-name CDKToolkit

# Re-bootstrap
cd infrastructure
cdk bootstrap
cd ..
```

#### Issue: Bootstrap succeeds but SSM parameter missing
**Cause:** Incomplete bootstrap

**Solution:**
```bash
# Verify bootstrap
bash check-bootstrap.sh

# If fails, force re-bootstrap
cd infrastructure
cdk bootstrap --force
cd ..
```

---

### 2. Deployment Failures

#### Issue: Stack stuck in UPDATE_ROLLBACK_FAILED
**Cause:** Resource deletion blocked

**Solution:**
```bash
# Use fix-rollback script
bash fix-rollback.sh

# Or manually
aws cloudformation continue-update-rollback --stack-name CIAlertStack

# If still fails, delete and redeploy
aws cloudformation delete-stack --stack-name CIAlertStack
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack
bash deploy.sh
```

#### Issue: Lambda deployment fails with "Code size too large"
**Cause:** Lambda package exceeds 50MB

**Solution:**
```bash
# Check Lambda size
cd lambdas/processing
du -sh *

# Remove unnecessary files
rm -rf __pycache__ *.pyc

# Redeploy
cd ../../infrastructure
cdk deploy CIAlertStack
```

#### Issue: API Gateway deployment fails
**Cause:** Cognito authorizer misconfiguration

**Solution:**
```bash
# Check Cognito User Pool exists
aws cognito-idp list-user-pools --max-results 10

# Verify User Pool ID in stack
aws cloudformation describe-stacks --stack-name CIAlertStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text

# Redeploy if needed
cd infrastructure
cdk deploy CIAlertStack
```

---

### 3. Authentication Issues

#### Issue: Frontend shows 401 Unauthorized
**Cause:** User not confirmed or token expired

**Solution:**
```bash
# Check user status
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
aws cognito-idp list-users --user-pool-id $USER_POOL_ID

# Confirm user
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com

# Or sign out and sign in again in UI
```

#### Issue: Sign-up fails with "Invalid password"
**Cause:** Password doesn't meet policy requirements

**Solution:**
```bash
# Password must have:
# - Minimum 8 characters
# - Uppercase letter
# - Lowercase letter
# - Number
# - Special character

# Example valid password: Test123!
```

#### Issue: "User does not exist" error
**Cause:** User not created or wrong User Pool

**Solution:**
```bash
# List all users
aws cognito-idp list-users --user-pool-id $USER_POOL_ID

# Create user if missing
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
aws cognito-idp sign-up \
  --client-id $USER_POOL_CLIENT_ID \
  --username test@example.com \
  --password Test123! \
  --user-attributes Name=email,Value=test@example.com
```

---

### 4. No Insights in UI

#### Issue: Insights table empty
**Cause:** No data ingested or processing failed

**Solution:**
```bash
# Trigger manual ingestion
bash test.sh ingestion

# Wait 15 seconds for processing
sleep 15

# Check insights table
INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text)
aws dynamodb scan --table-name $INSIGHTS_TABLE --max-items 5

# If still empty, check logs
PROCESSOR_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'Processor')].FunctionName|[0]" --output text)
aws logs tail /aws/lambda/$PROCESSOR_FUNCTION --since 30m
```

#### Issue: Processor Lambda not triggered
**Cause:** SQS event source not configured

**Solution:**
```bash
# Check event source mappings
PROCESSOR_FUNCTION=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'Processor')].FunctionName|[0]" --output text)
aws lambda list-event-source-mappings --function-name $PROCESSOR_FUNCTION

# If empty, redeploy stack
cd infrastructure
cdk deploy CIAlertStack
```

#### Issue: Bedrock access denied
**Cause:** Bedrock models not enabled

**Solution:**
```bash
# Enable models in AWS Console
# 1. Go to: https://console.aws.amazon.com/bedrock/home#/modelaccess
# 2. Click "Manage model access"
# 3. Enable: Claude 3.5 Sonnet v2
# 4. Enable: Claude 3.5 Haiku
# 5. Enable: Titan Text Embeddings v1
# 6. Click "Save changes" and wait for "Access granted"

# Verify access
aws bedrock list-foundation-models --region us-east-1 \
  --query 'modelSummaries[?contains(modelId, `claude-3-5`)].modelId'

# Test processor again
bash test.sh ingestion
```

---

### 5. No Email Digest Received

#### Issue: SES email not verified
**Cause:** Email address not verified in SES

**Solution:**
```bash
# Verify email
bash setup-ses.sh

# Check verification status
aws ses get-identity-verification-attributes \
  --identities your-email@example.com \
  --query 'VerificationAttributes.*.VerificationStatus'

# Should return "Success"
```

#### Issue: User email not in UserSettings table
**Cause:** Email not configured for user

**Solution:**
```bash
# Add user email
SETTINGS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'UserSettings')]|[0]" --output text)
aws dynamodb put-item --table-name $SETTINGS_TABLE --item '{
  "userId":{"S":"test@example.com"},
  "email":{"S":"your-verified-email@example.com"},
  "digestEnabled":{"BOOL":true}
}'

# Verify
aws dynamodb get-item --table-name $SETTINGS_TABLE \
  --key '{"userId":{"S":"test@example.com"}}'
```

#### Issue: Digest Lambda not triggered
**Cause:** EventBridge rule not configured

**Solution:**
```bash
# Check EventBridge rules
aws events list-rules --query "Rules[?contains(Name,'Digest')]"

# Check rule targets
aws events list-targets-by-rule --rule CIAlertStack-DailyDigestRule

# If missing, redeploy
cd infrastructure
cdk deploy CIAlertStack
```

#### Issue: SES in sandbox mode
**Cause:** SES account not moved to production

**Solution:**
```bash
# Check SES sending limits
aws ses get-send-quota

# If MaxSendRate is 1, you're in sandbox
# Request production access:
# 1. Go to: https://console.aws.amazon.com/ses/
# 2. Click "Account dashboard"
# 3. Click "Request production access"
# 4. Fill out form and submit
```

---

### 6. Frontend Issues

#### Issue: Frontend not loading (blank page)
**Cause:** CloudFront cache or build errors

**Solution:**
```bash
# Invalidate CloudFront cache
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"

# Wait 2-3 minutes, then check browser console for errors

# If still fails, rebuild and redeploy
bash deploy-cognito-frontend.sh
```

#### Issue: API calls fail with CORS errors
**Cause:** API Gateway CORS not configured

**Solution:**
```bash
# CORS is configured in infrastructure
# If still fails, check browser console for exact error

# Verify API Gateway CORS settings
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='CI Alert API'].id|[0]" --output text)
aws apigateway get-resource --rest-api-id $API_ID --resource-id ROOT

# Redeploy if needed
cd infrastructure
cdk deploy CIAlertStack
```

#### Issue: Environment variables not set
**Cause:** .env file not created during deployment

**Solution:**
```bash
# Manually create .env
cd frontend
cat > .env << EOF
REACT_APP_API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
REACT_APP_USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
REACT_APP_USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
REACT_APP_REGION=us-east-1
EOF

# Rebuild
npm run build

# Upload
BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)
aws s3 sync build/ s3://$BUCKET/ --delete
```

---

### 7. Lambda Function Errors

#### Issue: Lambda timeout
**Cause:** Function exceeds 300 second timeout

**Solution:**
```bash
# Check Lambda logs
FUNCTION_NAME=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'Processor')].FunctionName|[0]" --output text)
aws logs tail /aws/lambda/$FUNCTION_NAME --since 1h | grep "Task timed out"

# Increase timeout in infrastructure/lib/ci-alert-stack.ts
# timeout: cdk.Duration.seconds(300) -> cdk.Duration.seconds(600)

# Redeploy
cd infrastructure
cdk deploy CIAlertStack
```

#### Issue: Lambda out of memory
**Cause:** Function exceeds memory limit

**Solution:**
```bash
# Check memory usage in logs
aws logs tail /aws/lambda/$FUNCTION_NAME --since 1h | grep "Memory"

# Increase memory in infrastructure/lib/ci-alert-stack.ts
# memorySize: 512 -> memorySize: 1024

# Redeploy
cd infrastructure
cdk deploy CIAlertStack
```

#### Issue: Lambda cold start issues
**Cause:** First invocation slow

**Solution:**
```bash
# Enable provisioned concurrency (costs more)
aws lambda put-provisioned-concurrency-config \
  --function-name $FUNCTION_NAME \
  --provisioned-concurrent-executions 1

# Or use Lambda SnapStart (Java only)
# Or warm up with EventBridge rule every 5 minutes
```

---

### 8. DynamoDB Issues

#### Issue: ProvisionedThroughputExceededException
**Cause:** Too many reads/writes

**Solution:**
```bash
# Check table metrics
INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text)
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=$INSIGHTS_TABLE \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Tables use On-Demand billing, so this shouldn't happen
# If it does, check for infinite loops in Lambda
```

#### Issue: Item size exceeds 400KB
**Cause:** Storing too much data in single item

**Solution:**
```bash
# Truncate large fields in Lambda
# In processor.py, limit raw_content to 1000 chars
# raw_content: content[:1000]

# Or store large content in S3
# Store S3 key in DynamoDB instead
```

---

### 9. RAG Knowledge Base Issues

#### Issue: Knowledge base search returns no results
**Cause:** Documents not uploaded or ingestion job failed

**Solution:**
```bash
# Check knowledge base status
KB_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
aws bedrock-agent get-knowledge-base --knowledge-base-id $KB_ID

# Check ingestion jobs
aws bedrock-agent list-ingestion-jobs --knowledge-base-id $KB_ID

# Upload sample data if needed
bash upload-sample-data.sh

# Test search
bash test.sh rag
```

#### Issue: Agent preparation fails
**Cause:** Agent not properly configured or knowledge base not connected

**Solution:**
```bash
# Get agent ID
AGENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-BedrockAgent --query 'Stacks[0].Outputs[?OutputKey==`AgentIdOutput`].OutputValue' --output text)

# Check agent status
aws bedrock-agent get-agent --agent-id $AGENT_ID

# Prepare agent
aws bedrock-agent prepare-agent --agent-id $AGENT_ID

# Connect knowledge base
bash connect-knowledge-base.sh
```

#### Issue: OpenSearch Serverless collection not accessible
**Cause:** Security policies not configured correctly

**Solution:**
```bash
# Check collection status
aws opensearchserverless list-collections --collection-filters name=ci-alert-vectors

# Check security policies
aws opensearchserverless list-security-policies --type network
aws opensearchserverless list-security-policies --type encryption
aws opensearchserverless list-access-policies --type data

# Redeploy knowledge base stack if needed
cd infrastructure
cdk deploy CIAlert-KnowledgeBase
```

#### Issue: Vector embeddings not generated
**Cause:** Titan Embeddings model not enabled or ingestion failed

**Solution:**
```bash
# Check Titan model access
aws bedrock list-foundation-models --region us-east-1 \
  --query 'modelSummaries[?contains(modelId, `titan-embed`)].modelId'

# Check ingestion job logs
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --ingestion-job-id $JOB_ID

# Restart ingestion if failed
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID
```

---

### 10. Monitoring and Debugging

#### Issue: Can't find CloudWatch logs
**Cause:** Log group not created or wrong name

**Solution:**
```bash
# List all log groups
aws logs describe-log-groups --query 'logGroups[].logGroupName' | grep lambda

# Tail specific function
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --follow

# Filter logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/CIAlertStack-ProcessorFunction \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

#### Issue: CloudWatch dashboard not showing data
**Cause:** Metrics not published or dashboard misconfigured

**Solution:**
```bash
# Check if metrics exist
aws cloudwatch list-metrics --namespace AWS/Lambda

# Verify dashboard exists
aws cloudwatch list-dashboards

# Redeploy monitoring stack
cd infrastructure
cdk deploy CIAlert-Monitoring
```

---

## Advanced Troubleshooting

### Enable X-Ray Tracing
```bash
# Add to Lambda in infrastructure/lib/ci-alert-stack.ts
tracing: lambda.Tracing.ACTIVE

# Redeploy
cd infrastructure
cdk deploy CIAlertStack

# View traces
aws xray get-trace-summaries --start-time $(date -u -d '1 hour ago' +%s) --end-time $(date -u +%s)
```

### Enable VPC Flow Logs (if using VPC)
```bash
# Create log group
aws logs create-log-group --log-group-name /aws/vpc/flowlogs

# Enable flow logs
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids vpc-xxxxx \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /aws/vpc/flowlogs
```

### Debug API Gateway
```bash
# Enable CloudWatch logs for API Gateway
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='CI Alert API'].id|[0]" --output text)
aws apigateway update-stage \
  --rest-api-id $API_ID \
  --stage-name prod \
  --patch-operations op=replace,path=/accessLogSettings/destinationArn,value=arn:aws:logs:us-east-1:ACCOUNT_ID:log-group:/aws/apigateway/CIAlert

# View API Gateway logs
aws logs tail /aws/apigateway/CIAlert --follow
```

---

## Getting Help

### Collect Diagnostic Information
```bash
# Run full diagnostics
bash test.sh system > diagnostics.txt 2>&1
bash test.sh rag >> diagnostics.txt 2>&1

# Get all stack outputs
for stack in CIAlertStack CIAlert-KnowledgeBase CIAlert-BedrockAgent CIAlert-Frontend CIAlert-Monitoring; do
  aws cloudformation describe-stacks --stack-name $stack > ${stack}-outputs.json 2>/dev/null || echo "Stack $stack not found"
done

# Get recent logs
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --since 1h > processor-logs.txt
aws logs tail /aws/lambda/CIAlert-BedrockAgent-ActionLambda --since 1h > agent-logs.txt 2>/dev/null || echo "Agent logs not found"

# Package for support
tar -czf ci-alert-diagnostics.tar.gz diagnostics.txt *-outputs.json *-logs.txt
```

### Check AWS Service Health
```bash
# Check AWS status
curl -s https://status.aws.amazon.com/ | grep -i "service is operating normally"

# Check specific service
aws health describe-events --filter eventTypeCategories=issue
```

### Contact Support
1. Collect diagnostics (above)
2. Check [QUICKSTART.md](QUICKSTART.md) troubleshooting section
3. Review [README.md](README.md) for architecture
4. Check AWS Support Center
5. Review CloudWatch logs and metrics
