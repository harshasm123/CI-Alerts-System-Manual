# CI Alert System - Quick Start Guide

## 🚀 Deploy Production-Grade System in 10 Minutes

### Prerequisites Check

**Required:**
- AWS Account with admin access
- Ubuntu/Linux EC2 instance or local machine
- Internet connection

**Will be installed automatically:**
- AWS CLI v2
- Node.js 18+
- AWS CDK
- Python 3
- Docker

---

## Step-by-Step Deployment

### Step 1: Clone Repository

```bash
cd ~
git clone https://github.com/harshasm123/CI-Alerts-System-Manual.git
cd CI-Alerts-System-Manual
chmod +x *.sh
```

### Step 2: Install Prerequisites

```bash
./prereq.sh
```

**What this does:**
- Installs AWS CLI, Node.js, Python, Docker, CDK
- Configures AWS credentials (you'll be prompted)
- Auto-detects and fixes problematic regions (us-west-2 → us-east-1)
- Verifies AWS account access

**Expected output:**
```
✅ Prerequisites setup complete!
Current region: us-east-1
Account: 992167236365
```

### Step 3: Configure Region (Optional)

```bash
./config.sh
```

**Options:**
1. us-east-1 (Default, recommended)
2. us-west-1
3. eu-west-1
4. ap-southeast-1
5. Custom region

**Or skip if using default us-east-1**

### Step 4: Check Bootstrap Health

```bash
./check-bootstrap.sh
```

**Expected output:**
```
✅ CDKToolkit is healthy
✅ Bucket exists: s3://cdk-hnb659fds-assets-...
✅ Version: 21
✅ All IAM roles exist
🎉 CDK Bootstrap is healthy and ready!
```

**If bootstrap fails:**
```bash
./fix-region.sh  # Switches from problematic regions
```

### Step 5: Deploy All Stacks

```bash
./deploy.sh
```

**This deploys 4 stacks (~8-10 minutes):**

1. **CIAlertStack** (Core Infrastructure)
   - 3 DynamoDB tables (Insights, Watchlist, UserSettings)
   - 4 Lambda functions (Processor, PubMed, Watchlist API, Insights API)
   - API Gateway REST API
   - Cognito User Pool with MFA
   - S3 bucket with intelligent tiering
   - SQS queue for event processing
   - EventBridge daily schedule (9 AM)

2. **CIAlert-Frontend** (Web UI)
   - ECS Fargate cluster
   - Application Load Balancer
   - CloudFront distribution
   - WAF with rate limiting
   - ECR repository

3. **CIAlert-Monitoring** (Observability)
   - CloudWatch Dashboard
   - 3 CloudWatch Alarms (errors, latency, Lambda failures)
   - SNS topic for alerts

4. **CIAlert-CICD** (Automation)
   - CodePipeline
   - CodeBuild projects (infra, Lambda, frontend)
   - CodeCommit repository

**Expected output:**
```
🎉 Deployment Complete!
📊 Deployed Stacks:
  ✓ CIAlertStack (Core)
  ✓ CIAlert-Frontend (ECS, CloudFront, ALB, WAF)
  ✓ CIAlert-Monitoring (CloudWatch, Alarms, SNS)
  ✓ CIAlert-CICD (CodePipeline, CodeBuild, CodeCommit)

📋 Stack Outputs:
  Region: us-east-1
  Account: 992167236365
  API URL: https://abc123.execute-api.us-east-1.amazonaws.com/prod/
  User Pool: us-east-1_ABC123
```

### Step 6: Get All URLs

```bash
./GET_URLS.sh
```

**Output shows:**
- 🌐 API Gateway URL
- 🔐 Cognito User Pool ID
- 🔗 CloudFront Distribution URL
- ⚖️ Application Load Balancer URL
- 📊 CloudWatch Dashboard URL
- 🔄 CodePipeline URL
- 💻 CodeCommit Repository URL
- 🪣 S3 Data Bucket
- 📦 ECR Repository

### Step 7: Enable Bedrock Models

**CRITICAL: Required for AI processing**

1. Open AWS Console: https://console.aws.amazon.com/bedrock/
2. Click **Model access** (left sidebar)
3. Click **Manage model access** (orange button)
4. Enable these models:
   - ☑️ **Anthropic - Claude 3 Sonnet**
   - ☑️ **Amazon - Titan Embeddings G1 - Text**
5. Click **Save changes**
6. Wait for status: **Access granted** (~30 seconds)

**Verify:**
```bash
aws bedrock list-foundation-models --region us-east-1 --query 'modelSummaries[?contains(modelId, `claude-3-sonnet`)].modelId'
```

### Step 8: Test the System

```bash
# Set your API URL (from Step 6)
API_URL="https://abc123.execute-api.us-east-1.amazonaws.com/prod/"

# Test 1: Get insights (should return empty array initially)
curl "${API_URL}insights"

# Test 2: Add molecule to watchlist
curl -X POST "${API_URL}watchlist" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","molecule":"Keytruda"}'

# Test 3: Trigger PubMed ingestion
aws lambda invoke \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `PubMed`)].FunctionName' --output text) \
  --region us-east-1 \
  response.json

# Check response
cat response.json

# Test 4: Check insights after processing (wait 30 seconds)
sleep 30
curl "${API_URL}insights"
```

**Expected results:**
- Test 1: `[]` (empty array)
- Test 2: `{"message":"Added to watchlist"}`
- Test 3: `{"statusCode":200}`
- Test 4: JSON array with pharmaceutical insights

---

## 📊 What's Deployed

### Core Infrastructure (CIAlertStack)
- ✅ 3 DynamoDB tables (on-demand billing)
- ✅ S3 bucket (intelligent tiering)
- ✅ 4 Lambda functions (ARM64, Python 3.12)
- ✅ API Gateway (REST API with CORS)
- ✅ Cognito User Pool (email + MFA)
- ✅ SQS queue (14-day retention)
- ✅ EventBridge rule (daily 9 AM trigger)

### Frontend (CIAlert-Frontend)
- ✅ ECS Fargate (2 tasks, 512MB RAM)
- ✅ Application Load Balancer
- ✅ CloudFront distribution (HTTPS)
- ✅ WAF (rate limit: 2000 req/5min)
- ✅ ECR repository

### Monitoring (CIAlert-Monitoring)
- ✅ CloudWatch Dashboard (API, Lambda, DynamoDB metrics)
- ✅ 3 Alarms (5xx errors, latency, Lambda errors)
- ✅ SNS topic (email alerts)

### CI/CD (CIAlert-CICD)
- ✅ CodePipeline (3-stage: Source, Build, Deploy)
- ✅ CodeBuild (infra, Lambda, frontend builds)
- ✅ CodeCommit repository

---

## 💰 Cost Estimate

**Monthly costs (light usage):**
- DynamoDB: $5 (on-demand)
- Lambda: $10 (1M requests)
- API Gateway: $3.50 (1M requests)
- S3: $2 (10GB storage)
- ECS Fargate: $30 (2 tasks, 24/7)
- CloudFront: $5 (100GB transfer)
- Bedrock: $15 (Claude API calls)
- Other: $5 (CloudWatch, SQS, etc.)

**Total: ~$75/month**

**Cost optimization tips:**
- Use S3 lifecycle policies
- Scale down ECS to 1 task
- Use Lambda reserved concurrency
- Enable CloudWatch Logs retention

---

## 🔧 Troubleshooting

### Issue: CDK Bootstrap Fails

**Error:** `AWS::EarlyValidation::ResourceExistenceCheck`

**Fix:**
```bash
./fix-region.sh  # Switches to us-east-1
./deploy.sh
```

### Issue: Build Fails

**Error:** `npm install failed` or `tsc errors`

**Fix:**
```bash
cd infrastructure
rm -rf node_modules cdk.out
npm install
npm run build
cd ..
./deploy.sh
```

### Issue: Bedrock Access Denied

**Error:** `AccessDeniedException` in Lambda logs

**Fix:**
1. AWS Console → Bedrock → Model Access
2. Enable Claude 3 Sonnet
3. Wait for "Access granted" status

### Issue: API Returns 500

**Check Lambda logs:**
```bash
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --follow --region us-east-1
```

**Common causes:**
- Bedrock not enabled
- DynamoDB permissions
- Invalid JSON in request

### Issue: Stack Deployment Fails

**Check CloudFormation:**
```bash
aws cloudformation describe-stack-events \
  --stack-name CIAlertStack \
  --region us-east-1 \
  --max-items 10
```

**Rollback and retry:**
```bash
aws cloudformation delete-stack --stack-name CIAlertStack --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack --region us-east-1
./deploy.sh
```

---

## 📚 Additional Resources

- **Full Documentation:** `DEPLOYMENT_INSTRUCTIONS.md`
- **Architecture:** `README.md`
- **Healthcare Context:** `USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md`
- **Molecule Database:** `USA_MOLECULES_DATABASE.md`

---

## 🧹 Cleanup

**Delete all resources:**

```bash
cd ~/CI-Alerts-System-Manual

# Delete all stacks
cdk destroy --all --force

# Or manually
aws cloudformation delete-stack --stack-name CIAlert-CICD --region us-east-1
aws cloudformation delete-stack --stack-name CIAlert-Monitoring --region us-east-1
aws cloudformation delete-stack --stack-name CIAlert-Frontend --region us-east-1
aws cloudformation delete-stack --stack-name CIAlertStack --region us-east-1

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack --region us-east-1

# Delete bootstrap (optional)
aws cloudformation delete-stack --stack-name CDKToolkit --region us-east-1
```

**Verify cleanup:**
```bash
aws cloudformation list-stacks --region us-east-1 --query 'StackSummaries[?contains(StackName, `CIAlert`)].StackName'
```

---

## ✅ Success Checklist

- [ ] All 4 stacks deployed successfully
- [ ] API Gateway URL accessible
- [ ] Bedrock models enabled
- [ ] Test API calls return 200
- [ ] CloudWatch Dashboard shows metrics
- [ ] Lambda functions execute without errors
- [ ] DynamoDB tables contain data
- [ ] CloudFront distribution active

---

## 🎉 You're Done!

You now have a **production-grade CI Alert System** that:

✅ Ingests pharmaceutical news from PubMed daily
✅ Processes with Bedrock Claude 3 Sonnet AI
✅ Stores insights in DynamoDB
✅ Provides REST API for queries
✅ Sends daily email digests at 9 AM
✅ Monitors with CloudWatch dashboards
✅ Auto-deploys via CodePipeline
✅ Scales automatically with serverless

**Next steps:**
1. Customize molecule watchlist
2. Add more data sources (FDA, EMA, WIPO)
3. Build React frontend
4. Configure email alerts
5. Set up custom domain

**Questions?** Check `DEPLOYMENT_INSTRUCTIONS.md` for detailed guide.
