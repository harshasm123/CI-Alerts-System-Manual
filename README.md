<<<<<<< HEAD
# Competitive Intelligence Alert System

A production-grade AWS-based system that automatically ingests global drug/molecule-related news and produces daily summary emails at 9 AM for each user based on their saved molecule watchlist.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   External APIs │    │  EventBridge │    │   CloudFront    │
│  (PubMed, FDA,  │    │  (Scheduler) │    │      + WAF      │
│   EMA, WIPO)    │    └──────┬───────┘    └─────────┬───────┘
└─────────┬───────┘           │                      │
          │                   │                      │
          v                   v                      v
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Ingestion       │    │ Daily Digest │    │   React UI      │
│ Lambdas         │    │   Lambda     │    │  (ECS/Fargate)  │
└─────────┬───────┘    └──────┬───────┘    └─────────┬───────┘
          │                   │                      │
          v                   │                      │
┌─────────────────┐           │                      │
│   SQS Queue     │           │                      │
└─────────┬───────┘           │                      │
          │                   │                      │
          v                   │                      │
┌─────────────────┐           │                      │
│  Processor      │           │                      │
│   Lambda        │           │                      │
└─────────┬───────┘           │                      │
          │                   │                      │
          v                   v                      v
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Bedrock       │    │     SES      │    │   API Gateway   │
│ (Claude+Titan)  │    │   (Email)    │    │                 │
└─────────┬───────┘    └──────────────┘    └─────────┬───────┘
          │                                          │
          v                                          │
┌─────────────────┐                                  │
│   DynamoDB      │◄─────────────────────────────────┘
│ (Insights, User,│
│  Watchlist)     │
└─────────────────┘
```

## Key Features

- **Real-time Ingestion**: Fetches from PubMed, ClinicalTrials.gov, FDA, EMA, WIPO
- **AI-Powered Processing**: Uses Bedrock Claude 3 Sonnet and Titan Embeddings
- **Daily Digest**: 9 AM email alerts based on user watchlists
- **React UI**: Manage molecule watchlists and view insights
- **Production-Ready**: Full CI/CD, monitoring, security, cost-optimized

## Quick Start

```bash
# 1. Bootstrap CDK
cd infrastructure
cdk bootstrap

# 2. Deploy all stacks
cd ..
bash deploy.sh

# 3. Deploy frontend with authentication
bash deploy-cognito-frontend.sh

# 4. Create test user
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
aws cognito-idp sign-up --client-id $USER_POOL_CLIENT_ID --username test@example.com --password Test123!
aws cognito-idp admin-confirm-user --user-pool-id $USER_POOL_ID --username test@example.com
```

## Architecture Components

### Data Ingestion
- **Ingestion Lambdas**: Fetch from external APIs
- **SQS Queue**: Decouples ingestion from processing
- **EventBridge**: Schedules periodic ingestion

### AI Processing
- **Bedrock Agent**: Knowledge base with S3 + DynamoDB history
- **Claude 3 Sonnet**: Summarization and impact analysis
- **Titan Embeddings**: Relevance scoring

### Storage
- **DynamoDB**: Insights, user settings, watchlists
- **S3**: Raw data, processed data, knowledge base
- **VPC Endpoints**: Cost-optimized private connectivity

### User Interface
- **React App**: Molecule watchlist management with AWS Amplify
- **S3 + CloudFront**: Static hosting with CDN
- **Cognito**: Email-based authentication with auto-verify

### Notifications
- **Daily Digest**: 9 AM scheduled emails
- **SES**: Email delivery
- **Real-time Alerts**: High-impact event notifications

## Cost Optimization

- VPC Endpoints instead of NAT Gateway
- Spot instances for non-critical workloads
- S3 Intelligent Tiering
- DynamoDB On-Demand pricing
- Lambda ARM64 for better price/performance

## Security

- WAF protection on CloudFront
- VPC with private subnets
- IAM least privilege
- Cognito MFA
- Encrypted storage (S3, DynamoDB)

## Monitoring

- CloudWatch Dashboard
- Custom metrics and alarms
- X-Ray tracing
- Cost monitoring

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - 10-minute deployment guide
- **[DOCS.md](DOCS.md)** - Complete documentation index
- **[USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md](USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md)** - Healthcare domain context
- **[USA_MOLECULES_DATABASE.md](USA_MOLECULES_DATABASE.md)** - Pharmaceutical molecules database

## 🚀 Quick Deploy

```bash
bash deploy.sh                    # Deploy infrastructure
bash deploy-cognito-frontend.sh   # Deploy authenticated frontend
```

## 📁 Project Structure

See [DOCS.md](DOCS.md) for complete project structure and file descriptions.
