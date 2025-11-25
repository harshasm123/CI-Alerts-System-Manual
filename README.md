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

1. **Prerequisites**
   ```bash
   npm install -g aws-cdk
   pip install aws-cdk-lib
   ```

2. **Deploy Infrastructure**
   ```bash
   cd infrastructure
   npm install
   cdk bootstrap
   cdk deploy --all
   ```

3. **Deploy Application**
   ```bash
   cd frontend
   docker build -t ci-alert-ui .
   # Push to ECR and deploy via CodePipeline
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
- **React App**: Molecule watchlist management
- **ECS/Fargate**: Containerized deployment
- **Cognito**: User authentication with MFA

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

## Development

See individual component READMEs:
- [Infrastructure](./infrastructure/README.md)
- [Frontend](./frontend/README.md)
- [Lambdas](./lambdas/README.md)
=======
# CI-Alerts-System-Manual
CI alert system final
