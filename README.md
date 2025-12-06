# Competitive Intelligence Alert System

Production-grade AWS system for pharmaceutical competitive intelligence with RAG knowledge base, AI-powered insights, and intelligent email summaries.

## 🚀 Quick Deploy

```bash
# 1. Deploy infrastructure
bash deploy.sh

# 2. Setup email
bash setup-ses.sh

# 3. Deploy frontend
bash deploy-cognito-frontend.sh

# 4. Create user
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
aws cognito-idp sign-up --client-id $USER_POOL_CLIENT_ID --username test@example.com --password Test123! --user-attributes Name=email,Value=test@example.com
aws cognito-idp admin-confirm-user --user-pool-id $USER_POOL_ID --username test@example.com

# 5. Test system
bash test.sh ingestion
bash test.sh digest
```

See **[QUICKSTART.md](QUICKSTART.md)** for detailed instructions.

---

## Architecture

```
User → CloudFront → S3 (React + Amplify)
         ↓
    Cognito Auth (JWT)
         ↓
    API Gateway (Cognito Authorizer)
         ↓
    Lambda Functions ↔ Bedrock Agent (RAG)
         ↓                    ↓
    DynamoDB Tables    Knowledge Base
                            ↓
                    OpenSearch Serverless

EventBridge (Midnight) → PubMed Ingestion → SQS → Processor → Claude 3.5 Haiku
EventBridge (9 AM) → Digest Lambda → AI Summary → SES Email
```

---

## Key Features

✅ **Secure Authentication** - Cognito with email sign-in, auto-verify  
✅ **AI Insights** - Claude 3.5 models for pharmaceutical analysis  
✅ **RAG Knowledge Base** - OpenSearch Serverless with vector search  
✅ **Bedrock Agent** - Interactive chat with document citations  
✅ **AI-Powered Digests** - Claude-generated email summaries at 9 AM UTC  
✅ **User Watchlists** - Per-user molecule tracking  
✅ **React UI** - Modern frontend with AWS Amplify  
✅ **Protected API** - All endpoints require JWT tokens  
✅ **Automated Ingestion** - Daily PubMed data fetching  
✅ **Production Ready** - Monitoring, CI/CD, cost-optimized  

---

## Components

### Infrastructure (6 Stacks)
1. **CIAlertStack** - Core (DynamoDB, Lambda, API Gateway, Cognito, SQS, EventBridge)
2. **CIAlert-KnowledgeBase** - S3 + OpenSearch Serverless + Bedrock KB
3. **CIAlert-BedrockAgent** - Bedrock Agent + RAG actions
4. **CIAlert-Frontend** - S3 + CloudFront for React app
5. **CIAlert-Monitoring** - CloudWatch dashboards and alarms
6. **CIAlert-CICD** - CodePipeline for automated deployments

### DynamoDB Tables
- **InsightsTable** - AI-generated insights (PK: molecule, SK: timestamp)
- **WatchlistTable** - User watchlists (PK: userId, SK: molecule)
- **UserSettingsTable** - User preferences (PK: userId)

### Lambda Functions
- **PubMedFunction** - Fetches pharmaceutical news from PubMed API
- **ProcessorFunction** - AI processing with Claude 3.5 Haiku
- **WatchlistFunction** - Watchlist CRUD API
- **InsightsFunction** - Insights query API with GSI1 optimization
- **DigestFunction** - AI-powered email summaries (9 AM UTC)
- **AgentFunction** - Bedrock Agent API for chat interface
- **ActionHandler** - RAG search and DynamoDB actions

### API Endpoints (Protected)
- `GET /insights` - Get all insights (optimized with GSI1)
- `GET /insights?molecule=X` - Get insights for specific molecule
- `GET /watchlist?userId=X` - Get user watchlist
- `POST /watchlist` - Add molecule to watchlist
- `DELETE /watchlist?userId=X&molecule=Y` - Remove molecule
- `POST /agent` - Chat with Bedrock Agent (RAG + actions)

### EventBridge Rules
- **DailyIngestionRule** - Triggers at midnight UTC
- **DailyDigestRule** - Triggers at 9 AM UTC

---

## Testing

```bash
# Test Cognito
bash test.sh cognito

# Test full system
bash test.sh system

# Trigger ingestion
bash test.sh ingestion

# Test email digest
bash test.sh digest

# Test API
bash test.sh api
```

---

## Configuration

### SES Email Setup
```bash
bash setup-ses.sh
# Enter your email and verify it
```

### Add User Email for Digests
```bash
SETTINGS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'UserSettings')]|[0]" --output text)
aws dynamodb put-item --table-name $SETTINGS_TABLE --item '{
  "userId":{"S":"test@example.com"},
  "email":{"S":"your-verified-email@example.com"},
  "digestEnabled":{"BOOL":true}
}'
```

---

## Cost Estimate

**Monthly (100 users, 100 insights/day):**
- DynamoDB: $5 (On-Demand)
- Lambda: $2 (1M requests)
- API Gateway: $3.50 (1M requests)
- S3: $5 (50GB + documents)
- CloudFront: $1 (10GB transfer)
- Cognito: Free (50K MAU)
- SES: $1 (10K emails)
- CloudWatch: $3
- **Bedrock Models:**
  - Claude 3.5 Haiku (batch): $0.50
  - Claude 3.5 Sonnet v2 (agent): $44
  - Titan Embeddings: $15
- **OpenSearch Serverless:** $55 (2 OCUs)

**Total: ~$135/month**

**Cost Optimization:**
- 2-model approach saves $13.50/month vs single Sonnet
- OpenSearch Serverless vs Service saves $35/month
- Serverless architecture (no ECS/VPC costs)

---

## Security

- ✅ Cognito JWT authentication on all API endpoints
- ✅ S3 and DynamoDB encryption at rest
- ✅ HTTPS only via CloudFront
- ✅ IAM least privilege roles
- ✅ No hardcoded credentials
- ✅ Password policy: 8+ chars, uppercase, lowercase, number, symbol

---

## Monitoring

### CloudWatch Dashboard
- API Gateway: requests, latency, errors
- Lambda: invocations, duration, errors
- DynamoDB: read/write capacity

### CloudWatch Alarms
- API 5xx errors > 10
- API latency > 2000ms
- Lambda errors > 5

### View Logs
```bash
# PubMed ingestion
aws logs tail /aws/lambda/CIAlertStack-PubMedFunction --follow

# Processor
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --follow

# Digest
aws logs tail /aws/lambda/CIAlertStack-DigestFunction --follow
```

---

## Troubleshooting

### CDK Bootstrap Fails (CloudFormation Hook Error)
```bash
# Quick fix - switch region
chmod +x fix-region.sh
./fix-region.sh

# Then deploy again
./deploy.sh
```
See `QUICK_FIX.md` for details.

### Frontend 401 Errors
```bash
aws cognito-idp admin-confirm-user --user-pool-id $USER_POOL_ID --username test@example.com
```

### No Insights
```bash
bash test.sh ingestion
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --since 10m
```

### No Email Digest
```bash
bash setup-ses.sh  # Verify email
bash test.sh digest  # Test manually
aws logs tail /aws/lambda/CIAlertStack-DigestFunction --since 10m
```

### CloudFront Cache
```bash
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
```

---

## Cleanup

```bash
cd infrastructure
cdk destroy --all

# Or manually
aws cloudformation delete-stack --stack-name CIAlert-CICD
aws cloudformation delete-stack --stack-name CIAlert-Monitoring
aws cloudformation delete-stack --stack-name CIAlert-Frontend
aws cloudformation delete-stack --stack-name CIAlertStack
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack
```

---

## Project Structure

```
CI Alert System/
├── infrastructure/          # CDK infrastructure code
│   ├── lib/
│   │   ├── ci-alert-stack.ts       # Core stack
│   │   ├── knowledge-base-stack.ts # S3 + OpenSearch + Bedrock KB
│   │   ├── bedrock-agent-stack.ts  # Agent + RAG actions
│   │   ├── frontend-stack.ts       # S3 + CloudFront
│   │   ├── monitoring-stack.ts     # CloudWatch
│   │   └── cicd-stack.ts           # CodePipeline
│   └── bin/ci-alert.ts
├── lambdas/
│   ├── processing/
│   │   ├── processor.py            # Claude 3.5 Haiku integration
│   │   └── document_processor.py   # Knowledge base sync
│   ├── ingestion/pubmed_ingestion.py
│   ├── api/
│   │   ├── watchlist_api.py
│   │   ├── insights_api.py         # GSI1 optimized queries
│   │   └── agent_api.py            # Bedrock Agent endpoint
│   ├── bedrock-agent/
│   │   ├── action_handler.py       # RAG + DynamoDB actions
│   │   └── knowledge_search.py     # Vector search functions
│   └── notifications/daily_digest.py  # AI-powered email summaries
├── frontend/
│   ├── src/
│   │   ├── App.js                  # React + Amplify auth + tabs
│   │   ├── App.css                 # Modern UI styling
│   │   ├── Chat.js                 # Bedrock Agent chat interface
│   │   ├── Chat.css                # Chat UI styling
│   │   └── index.js
│   ├── public/index.html
│   └── package.json
├── deploy.sh                       # Main deployment (6 stacks)
├── deploy-cognito-frontend.sh      # Frontend deployment
├── setup-ses.sh                    # Email verification
├── test.sh                         # Unified test script
├── connect-knowledge-base.sh       # Link KB to Agent
├── upload-sample-data.sh           # Sample pharmaceutical docs
├── check-bootstrap.sh              # CDK bootstrap check
├── fix-rollback.sh                 # Stack cleanup
├── destroy.sh                      # Delete all stacks
├── prereq.sh                       # Install prerequisites
├── shell scripts/GET_URLS.sh       # Get all URLs
├── README.md                       # This file
├── QUICKSTART.md                   # Detailed guide
└── RAG_IMPLEMENTATION.md           # RAG setup and usage
```

---

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Complete deployment guide with prerequisites
- **[USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md](USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md)** - Healthcare domain context
- **[USA_MOLECULES_DATABASE.md](USA_MOLECULES_DATABASE.md)** - Pharmaceutical molecules database

---

## Support

For issues or questions:
1. Check logs: `aws logs tail /aws/lambda/FUNCTION_NAME --follow`
2. Run tests: `bash test-system.sh`
3. Review CloudWatch dashboard
4. Check [QUICKSTART.md](QUICKSTART.md) troubleshooting section

Final Documentation Structure 
Core Documentation (2 files)
✅ README.md - Main overview, quick deploy, architecture

✅ QUICKSTART.md - Step-by-step deployment guide

Reference Documentation (8 files)
✅ DOCS.md - Documentation index and navigation

✅ PROJECT_OVERVIEW.md - High-level project description

✅ SYSTEM_DESIGN.md - Detailed architecture and design decisions

✅ CICD_GUIDE.md - CI/CD pipeline setup and usage

✅ GIT_COMMANDS.md - Git workflow and commands

✅ EC2_DEPLOYMENT.md - EC2 Ubuntu deployment guide

✅ GITHUB_SETUP.md - GitHub repository setup

✅ HEALTHCARE_USE_CASE.md - Healthcare CI use cases and ROI

Domain Documentation (2 files)
✅ USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md - Healthcare context

✅ USA_MOLECULES_DATABASE.md - Pharmaceutical molecules

Essential Scripts (12 files)
✅ deploy.sh - Main deployment

✅ deploy-cognito-frontend.sh - Frontend deployment

✅ setup-ses.sh - Email verification

✅ test.sh - Unified testing (cognito|system|digest|ingestion|api)

✅ check-bootstrap.sh - CDK bootstrap check

✅ fix-rollback.sh - Stack cleanup

✅ destroy.sh - Delete all stacks

✅ prereq.sh - Install prerequisites

✅ GET_URLS.sh - Get all URLs

✅ config.sh - Configuration

✅ ec2_setup.sh - EC2 setup

✅ push_to_github.sh - Git push helper