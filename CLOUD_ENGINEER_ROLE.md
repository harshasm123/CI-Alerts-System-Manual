# Cloud Engineer Role - CI Alert System

## Role Overview

As a Cloud Engineer on the CI Alert System project, you are responsible for designing, deploying, and maintaining a production-grade serverless application on AWS that provides pharmaceutical competitive intelligence with AI-powered insights.

---

## Roles & Responsibilities

### 1. Infrastructure Management
- Design and implement AWS infrastructure using CDK (TypeScript)
- Deploy and manage 4 CloudFormation stacks (Core, Frontend, Monitoring, CI/CD)
- Maintain infrastructure as code in Git repository
- Perform infrastructure updates and rollbacks

### 2. Application Deployment
- Deploy Lambda functions (Python) for data processing and APIs
- Configure API Gateway with Cognito authentication
- Set up DynamoDB tables with proper indexes
- Deploy React frontend to S3 + CloudFront

### 3. Security & Compliance
- Implement Cognito user authentication and authorization
- Configure IAM roles with least privilege access
- Enable encryption at rest and in transit
- Manage secrets in AWS Secrets Manager
- Ensure HIPAA compliance for healthcare data

### 4. Monitoring & Operations
- Set up CloudWatch dashboards and alarms
- Monitor Lambda performance and errors
- Track API Gateway metrics and latency
- Respond to production incidents
- Perform root cause analysis

### 5. Cost Optimization
- Monitor AWS spending with Cost Explorer
- Optimize Lambda memory and timeout settings
- Implement S3 lifecycle policies
- Use DynamoDB on-demand billing
- Right-size resources based on usage

### 6. CI/CD Pipeline
- Maintain CodePipeline for automated deployments
- Configure CodeBuild for testing and packaging
- Set up GitHub integration for source control
- Implement blue-green deployments
- Manage deployment rollbacks

---

## Day-to-Day Activities

### Morning (9:00 AM - 12:00 PM)

#### Daily Standup (9:00 AM)
- Review overnight incidents and alerts
- Discuss deployment plans for the day
- Coordinate with development team

#### Check System Health (9:15 AM)
```bash
# Check CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM

# Review Lambda errors
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --since 12h | grep ERROR

# Check API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

#### Infrastructure Updates (10:00 AM)
```bash
# Pull latest code
git pull origin main

# Review infrastructure changes
cd infrastructure
git diff HEAD~1 lib/ci-alert-stack.ts

# Deploy updates
npm run build
cdk diff CIAlertStack
cdk deploy CIAlertStack --require-approval never
```

#### Monitor Deployment (11:00 AM)
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name CIAlertStack \
  --query 'Stacks[0].StackStatus'

# Verify Lambda functions updated
aws lambda list-functions --query 'Functions[?contains(FunctionName, `CIAlert`)].{Name:FunctionName,Updated:LastModified}'

# Test endpoints
bash test.sh api
```

### Afternoon (1:00 PM - 5:00 PM)

#### Performance Optimization (1:00 PM)
```bash
# Analyze Lambda performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=CIAlertStack-ProcessorFunction \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Average,Maximum

# Check memory usage
aws logs filter-log-events \
  --log-group-name /aws/lambda/CIAlertStack-ProcessorFunction \
  --filter-pattern "Max Memory Used" \
  --start-time $(date -d '24 hours ago' +%s)000
```

#### Cost Review (2:00 PM)
```bash
# Check daily costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Identify cost anomalies
aws ce get-anomalies \
  --date-interval Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d)
```

#### Security Audit (3:00 PM)
```bash
# Review IAM policies
aws iam list-policies --scope Local

# Check Cognito user activity
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
aws cognito-idp list-users --user-pool-id $USER_POOL_ID

# Review CloudTrail logs
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteStack \
  --start-time $(date -d '7 days ago' +%s) \
  --max-results 10
```

#### Documentation Updates (4:00 PM)
```bash
# Update README with new features
vim README.md

# Update troubleshooting guide
vim TROUBLESHOOTING.md

# Commit changes
git add .
git commit -m "docs: update deployment instructions"
git push origin main
```

### Evening (5:00 PM - 6:00 PM)

#### End-of-Day Review
- Review CloudWatch dashboards
- Check for any pending alarms
- Document any issues encountered
- Plan next day's tasks

---

## Common Scenarios & Interview Questions

### Scenario 1: Lambda Function Timeout

**Problem:** Processor Lambda timing out after 300 seconds

**Interview Question:** "How would you troubleshoot and fix a Lambda timeout issue?"

**Answer:**
```bash
# 1. Check CloudWatch logs
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --since 1h | grep "Task timed out"

# 2. Analyze duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=CIAlertStack-ProcessorFunction \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# 3. Increase timeout in CDK
# Edit infrastructure/lib/ci-alert-stack.ts
timeout: cdk.Duration.seconds(600)

# 4. Optimize code (batch processing, caching)
# 5. Redeploy
cd infrastructure
cdk deploy CIAlertStack
```

**Key Points:**
- Check logs first to identify bottleneck
- Analyze metrics to understand pattern
- Increase timeout as temporary fix
- Optimize code for long-term solution
- Consider breaking into smaller functions

---

### Scenario 2: High DynamoDB Costs

**Problem:** DynamoDB costs increased from $5 to $50/month

**Interview Question:** "How would you investigate and reduce DynamoDB costs?"

**Answer:**
```bash
# 1. Check table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=InsightsTable \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# 2. Identify hot partitions
aws dynamodb describe-table --table-name InsightsTable \
  --query 'Table.{Reads:ProvisionedThroughput.ReadCapacityUnits,Writes:ProvisionedThroughput.WriteCapacityUnits}'

# 3. Review access patterns
aws logs filter-log-events \
  --log-group-name /aws/lambda/CIAlertStack-InsightsFunction \
  --filter-pattern "DynamoDB" \
  --start-time $(date -d '24 hours ago' +%s)000

# 4. Optimize queries
# - Add indexes for common queries
# - Use projection to reduce data transfer
# - Implement caching (DAX or ElastiCache)
# - Add TTL for old data

# 5. Enable point-in-time recovery only if needed
aws dynamodb update-continuous-backups \
  --table-name InsightsTable \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=false
```

**Key Points:**
- Analyze read/write patterns
- Identify inefficient queries (scans vs queries)
- Implement caching to reduce reads
- Use TTL to auto-delete old data
- Consider switching to on-demand if traffic is unpredictable

---

### Scenario 3: API Gateway 5xx Errors

**Problem:** API returning 500 errors intermittently

**Interview Question:** "How would you debug API Gateway 5xx errors?"

**Answer:**
```bash
# 1. Check API Gateway logs
aws logs tail /aws/apigateway/CIAlert --since 1h | grep "500"

# 2. Check Lambda errors
aws logs tail /aws/lambda/CIAlertStack-WatchlistFunction --since 1h | grep ERROR

# 3. Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --dimensions Name=ApiName,Value="CI Alert API" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# 4. Test endpoint manually
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
curl -v "${API_URL}insights"

# 5. Check Lambda permissions
aws lambda get-policy --function-name CIAlertStack-WatchlistFunction

# 6. Enable X-Ray tracing for detailed analysis
aws lambda update-function-configuration \
  --function-name CIAlertStack-WatchlistFunction \
  --tracing-config Mode=Active
```

**Key Points:**
- Check both API Gateway and Lambda logs
- Verify Lambda has correct permissions
- Check for timeout issues
- Enable X-Ray for distributed tracing
- Test with curl to isolate issue

---

### Scenario 4: Cognito Authentication Failures

**Problem:** Users unable to sign in to frontend

**Interview Question:** "How would you troubleshoot Cognito authentication issues?"

**Answer:**
```bash
# 1. Check user status
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
aws cognito-idp list-users --user-pool-id $USER_POOL_ID

# 2. Verify user is confirmed
aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com

# 3. Check User Pool Client settings
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $USER_POOL_CLIENT_ID

# 4. Verify frontend environment variables
cat frontend/.env

# 5. Check browser console for errors
# Look for CORS issues, invalid tokens, etc.

# 6. Test authentication manually
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $USER_POOL_CLIENT_ID \
  --auth-parameters USERNAME=test@example.com,PASSWORD=Test123!
```

**Key Points:**
- Verify user is confirmed (not in UNCONFIRMED state)
- Check User Pool Client has correct auth flows enabled
- Verify frontend has correct Cognito config
- Check browser console for client-side errors
- Test auth flow manually with AWS CLI

---

### Scenario 5: CloudFormation Stack Stuck in UPDATE_ROLLBACK_FAILED

**Problem:** Stack deployment failed and rollback also failed

**Interview Question:** "How would you recover from a failed CloudFormation rollback?"

**Answer:**
```bash
# 1. Check stack events
aws cloudformation describe-stack-events \
  --stack-name CIAlertStack \
  --max-items 20 \
  --query 'StackEvents[?ResourceStatus==`UPDATE_FAILED`]'

# 2. Identify resource causing failure
aws cloudformation describe-stack-resources \
  --stack-name CIAlertStack \
  --query 'StackResources[?ResourceStatus==`UPDATE_FAILED`]'

# 3. Continue rollback (skip failed resources)
aws cloudformation continue-update-rollback \
  --stack-name CIAlertStack \
  --resources-to-skip FailedResourceLogicalId

# 4. If still fails, delete and recreate
aws cloudformation delete-stack --stack-name CIAlertStack
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack

# 5. Redeploy from scratch
cd infrastructure
cdk deploy CIAlertStack

# 6. Restore data from backups if needed
aws dynamodb restore-table-from-backup \
  --target-table-name InsightsTable \
  --backup-arn arn:aws:dynamodb:us-east-1:123456789012:table/InsightsTable/backup/01234567890123-abcdefgh
```

**Key Points:**
- Check stack events to identify root cause
- Use continue-update-rollback to skip problematic resources
- Delete and recreate stack if rollback fails
- Always have backup strategy for data
- Use infrastructure as code to easily recreate

---

### Scenario 6: Bedrock API Rate Limiting

**Problem:** Processor Lambda getting throttled by Bedrock

**Interview Question:** "How would you handle Bedrock API rate limits?"

**Answer:**
```bash
# 1. Check CloudWatch logs for throttling errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/CIAlertStack-ProcessorFunction \
  --filter-pattern "ThrottlingException" \
  --start-time $(date -d '24 hours ago' +%s)000

# 2. Implement exponential backoff in code
# Edit lambdas/processing/processor.py
import time
from botocore.exceptions import ClientError

def invoke_bedrock_with_retry(prompt, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = bedrock.invoke_model(...)
            return response
        except ClientError as e:
            if e.response['Error']['Code'] == 'ThrottlingException':
                wait_time = 2 ** attempt
                time.sleep(wait_time)
            else:
                raise
    raise Exception("Max retries exceeded")

# 3. Reduce batch size in SQS event source
aws lambda update-event-source-mapping \
  --uuid EVENT_SOURCE_UUID \
  --batch-size 5  # Reduce from 10 to 5

# 4. Request quota increase
# AWS Console → Service Quotas → Amazon Bedrock → Request quota increase

# 5. Implement queue-based processing with rate limiting
# Use SQS with visibility timeout and DLQ
```

**Key Points:**
- Implement exponential backoff for retries
- Reduce batch size to process fewer items at once
- Request quota increase from AWS
- Use SQS to buffer requests
- Monitor throttling metrics in CloudWatch

---

## Interview Preparation Tips

### Technical Skills to Highlight

1. **AWS Services:**
   - Lambda, API Gateway, DynamoDB, S3, CloudFront
   - Cognito, SES, SQS, EventBridge
   - CloudWatch, CloudTrail, X-Ray
   - Bedrock (AI/ML)

2. **Infrastructure as Code:**
   - AWS CDK (TypeScript)
   - CloudFormation
   - Git version control

3. **Programming:**
   - Python (Lambda functions)
   - TypeScript (CDK)
   - JavaScript/React (Frontend)
   - Bash scripting

4. **DevOps:**
   - CI/CD with CodePipeline
   - Automated testing
   - Monitoring and alerting
   - Incident response

5. **Security:**
   - IAM roles and policies
   - Cognito authentication
   - Encryption at rest/transit
   - Compliance (HIPAA, SOC 2)

### Common Interview Questions

1. **"Describe your experience with serverless architecture."**
   - Explain Lambda, API Gateway, DynamoDB
   - Discuss benefits (no server management, auto-scaling, pay-per-use)
   - Mention challenges (cold starts, debugging, vendor lock-in)

2. **"How do you ensure high availability?"**
   - Multi-AZ deployment
   - SQS for fault tolerance
   - Retry logic and DLQ
   - CloudWatch alarms for proactive monitoring

3. **"How do you optimize AWS costs?"**
   - Right-size Lambda memory
   - Use DynamoDB on-demand
   - S3 lifecycle policies
   - Monitor with Cost Explorer
   - Use free tier services

4. **"Describe a challenging production issue you resolved."**
   - Use scenarios above as examples
   - Follow STAR method (Situation, Task, Action, Result)
   - Emphasize problem-solving and communication

5. **"How do you implement security best practices?"**
   - Least privilege IAM
   - Encryption at rest/transit
   - Cognito for authentication
   - Regular security audits
   - CloudTrail for audit logging

---

## Key Metrics to Track

### Performance Metrics
- Lambda duration (p50, p95, p99)
- API Gateway latency
- DynamoDB read/write latency
- Bedrock API response time

### Reliability Metrics
- Lambda error rate
- API Gateway 5xx error rate
- SQS dead letter queue depth
- CloudWatch alarm state

### Cost Metrics
- Daily AWS spend by service
- Lambda invocations and duration
- DynamoDB read/write units
- Bedrock token usage

### Security Metrics
- Failed authentication attempts
- IAM policy changes
- Unusual API activity
- CloudTrail events

---

## Career Growth Path

### Junior Cloud Engineer (0-2 years)
- Deploy infrastructure with guidance
- Monitor CloudWatch dashboards
- Respond to incidents with runbooks
- Update documentation

### Cloud Engineer (2-4 years)
- Design and implement new features
- Optimize performance and costs
- Lead incident response
- Mentor junior engineers

### Senior Cloud Engineer (4+ years)
- Architect entire systems
- Define best practices and standards
- Lead major migrations
- Influence technology decisions

### Cloud Architect (6+ years)
- Design multi-region architectures
- Define cloud strategy
- Lead multiple teams
- Evangelize cloud adoption
