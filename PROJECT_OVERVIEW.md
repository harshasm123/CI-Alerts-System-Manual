# CI Alert System - Project Overview

## 🎯 Executive Summary

The Competitive Intelligence Alert System is a production-grade AWS solution that automatically ingests global drug/molecule-related news and delivers personalized daily digest emails at 9 AM based on user-defined molecule watchlists. The system leverages AWS Bedrock AI for intelligent analysis and provides a React-based web interface for user management.

## 🏗️ Architecture Overview

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

## 📁 Project Structure

```
CI Alert System/
├── README.md                          # Main project documentation
├── SYSTEM_DESIGN.md                   # Detailed system design
├── DEPLOYMENT_GUIDE.md                # Step-by-step deployment
├── PROJECT_OVERVIEW.md                # This file
├── deploy.sh                          # Automated deployment script
│
├── infrastructure/                    # AWS CDK Infrastructure as Code
│   ├── package.json                   # CDK dependencies
│   ├── cdk.json                       # CDK configuration
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── lib/
│   │   ├── app.ts                     # Main CDK app
│   │   └── stacks/
│   │       ├── network-stack.ts       # VPC, subnets, endpoints
│   │       ├── storage-stack.ts       # DynamoDB, S3, SQS
│   │       ├── auth-stack.ts          # Cognito User Pool
│   │       ├── compute-stack.ts       # Lambda functions
│   │       ├── api-stack.ts           # API Gateway
│   │       ├── frontend-stack.ts      # ECS, ALB, CloudFront
│   │       ├── monitoring-stack.ts    # CloudWatch, alarms
│   │       └── cicd-stack.ts          # CodePipeline, CodeBuild
│
├── lambdas/                           # AWS Lambda Functions
│   ├── requirements.txt               # Python dependencies
│   ├── ingestion/                     # Data ingestion functions
│   │   ├── pubmed_ingestion.py        # PubMed API integration
│   │   ├── clinical_trials_ingestion.py # ClinicalTrials.gov API
│   │   ├── fda_ingestion.py           # FDA RSS feeds
│   │   ├── ema_ingestion.py           # EMA RSS feeds
│   │   └── wipo_ingestion.py          # WIPO patent data
│   ├── processing/
│   │   └── processor.py               # AI-powered event processing
│   ├── notifications/
│   │   └── daily_digest.py            # Daily email generation
│   └── api/                           # REST API functions
│       ├── watchlist_api.py           # Molecule watchlist management
│       ├── insights_api.py            # Insights retrieval
│       └── user_settings_api.py       # User preferences
│
├── frontend/                          # React Web Application
│   ├── package.json                   # React dependencies
│   ├── Dockerfile                     # Container configuration
│   ├── nginx.conf                     # Nginx configuration
│   ├── public/
│   │   └── index.html                 # HTML template
│   └── src/
│       ├── index.js                   # React entry point
│       ├── App.js                     # Main application component
│       ├── components/
│       │   ├── Layout.js              # Navigation and layout
│       │   └── LoadingSpinner.js      # Loading component
│       ├── pages/
│       │   ├── Dashboard.js           # Main dashboard
│       │   ├── Watchlist.js           # Molecule management
│       │   ├── Insights.js            # Insights viewer
│       │   └── Settings.js            # User settings
│       └── services/
│           └── api.js                 # API service layer
│
├── scripts/                           # Utility scripts
│   └── setup_bedrock_agent.py         # Bedrock Agent provisioning
│
├── cicd/                              # CI/CD Configuration
│   ├── buildspec.yml                  # CodeBuild specification
│   └── pipeline.yml                   # CloudFormation pipeline
│
└── monitoring/                        # Monitoring Configuration
    └── dashboard.json                 # CloudWatch dashboard
```

## 🔧 Core Components

### Data Ingestion Layer
- **PubMed Integration**: Fetches recent pharmaceutical research papers
- **ClinicalTrials.gov**: Monitors clinical trial updates
- **FDA RSS Feeds**: Tracks drug approvals and safety alerts
- **EMA Integration**: European regulatory updates
- **WIPO Patents**: Patent publication monitoring
- **SQS Processing**: Decoupled event processing pipeline

### AI Processing Layer
- **Bedrock Agent**: Orchestrates AI workflows with knowledge base
- **Claude 3 Sonnet**: Advanced text analysis and summarization
- **Titan Embeddings**: Semantic similarity and relevance scoring
- **Knowledge Base**: S3-backed vector store with historical insights

### Storage Layer
- **DynamoDB Tables**:
  - `InsightsTable`: Processed competitive intelligence
  - `UserSettingsTable`: User preferences and configuration
  - `WatchlistTable`: User molecule watchlists
- **S3 Buckets**: Raw data, processed insights, knowledge base vectors

### User Interface Layer
- **React Application**: Modern, responsive web interface
- **Material-UI**: Professional component library
- **AWS Amplify**: Authentication and API integration
- **ECS/Fargate**: Containerized deployment with auto-scaling

### Notification Layer
- **Daily Digest**: Personalized 9 AM email summaries
- **SES Integration**: Reliable email delivery
- **Real-time Alerts**: High-impact event notifications

## 🚀 Key Features

### For End Users
- **Molecule Watchlists**: Track specific pharmaceutical compounds
- **Daily Digest Emails**: Personalized 9 AM summaries
- **Real-time Insights**: Immediate high-impact alerts
- **Advanced Filtering**: Source, impact level, relevance scoring
- **Competitive Intelligence**: AI-powered competitive analysis

### For Administrators
- **Automated Ingestion**: Hands-off data collection
- **AI-Powered Processing**: Intelligent relevance scoring
- **Scalable Architecture**: Handles growing data volumes
- **Cost Optimized**: VPC endpoints, intelligent tiering
- **Production Ready**: Monitoring, alarms, CI/CD

## 💰 Cost Analysis

### Estimated Monthly Costs (1000 users)
| Component | Cost | Description |
|-----------|------|-------------|
| **Compute** | $200 | Lambda executions + ECS tasks |
| **Storage** | $50 | DynamoDB + S3 storage |
| **AI/ML** | $300 | Bedrock Claude + Titan usage |
| **Networking** | $100 | CloudFront + VPC Endpoints |
| **Other** | $50 | SES, API Gateway, monitoring |
| **Total** | **$700/month** | Full system operation |

### Cost Optimizations Implemented
- VPC Endpoints instead of NAT Gateway (-$90/month)
- S3 Intelligent Tiering for automatic cost optimization
- DynamoDB On-Demand pricing for variable workloads
- Lambda ARM64 for 20% better price/performance
- Spot instances for non-critical batch processing

## 🔒 Security Features

### Network Security
- **Private Subnets**: All compute resources isolated
- **VPC Endpoints**: Private AWS service communication
- **WAF Protection**: CloudFront security rules
- **Security Groups**: Least privilege network access

### Data Security
- **Encryption at Rest**: S3 SSE-S3, DynamoDB AWS managed
- **Encryption in Transit**: HTTPS/TLS everywhere
- **IAM Least Privilege**: Minimal required permissions
- **Cognito Authentication**: Secure user management

### Operational Security
- **CloudTrail Logging**: Complete API audit trail
- **Secrets Management**: AWS Secrets Manager integration
- **Resource Tagging**: Comprehensive resource tracking
- **Access Reviews**: Regular permission audits

## 📊 Monitoring & Observability

### CloudWatch Metrics
- **Lambda Performance**: Invocations, errors, duration
- **ECS Utilization**: CPU, memory, task health
- **API Gateway**: Request count, latency, errors
- **DynamoDB**: Read/write capacity, throttling
- **Business Metrics**: Insights generated, emails sent

### Alerting
- **Error Rate Alarms**: Lambda function failures
- **Performance Alarms**: High latency, timeouts
- **Cost Alarms**: Monthly spending thresholds
- **Business Alarms**: Processing pipeline health

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Centralized Logs**: CloudWatch Logs aggregation
- **Log Retention**: 30 days operational, 1 year audit
- **X-Ray Tracing**: End-to-end request tracing

## 🔄 CI/CD Pipeline

### Automated Deployment
- **CodeCommit**: Source code repository
- **CodeBuild**: Build and test automation
- **CodePipeline**: Multi-stage deployment
- **CDK Deployment**: Infrastructure as Code

### Quality Gates
- **Unit Tests**: Lambda function testing
- **Integration Tests**: API endpoint validation
- **Security Scans**: Container vulnerability scanning
- **Performance Tests**: Load testing for APIs

### Deployment Stages
1. **Source**: Code commit triggers pipeline
2. **Build**: Docker image + Lambda packages
3. **Test**: Automated testing suite
4. **Deploy**: Blue/green ECS deployment
5. **Verify**: Health checks and rollback

## 📈 Scalability

### Horizontal Scaling
- **Lambda Concurrency**: Auto-scales to 1000+ concurrent executions
- **ECS Auto Scaling**: CPU/memory-based task scaling
- **API Gateway**: Handles 10,000+ requests per second
- **DynamoDB**: On-demand scaling for variable workloads

### Performance Optimization
- **ARM64 Lambda**: 20% better price/performance
- **CloudFront Caching**: Global edge locations
- **DynamoDB GSI**: Optimized query patterns
- **Connection Pooling**: Efficient database connections

## 🎯 Success Metrics

### Technical KPIs
- **Uptime**: 99.9% availability target
- **Latency**: <2s API response time
- **Error Rate**: <0.1% Lambda error rate
- **Data Freshness**: <1 hour ingestion lag

### Business KPIs
- **User Engagement**: Daily active users
- **Content Quality**: Relevance score distribution
- **Email Delivery**: 99%+ delivery rate
- **Cost Efficiency**: Cost per insight generated

## 🚀 Getting Started

### Quick Deployment
```bash
git clone <repository-url>
cd ci-alert-system
chmod +x deploy.sh
./deploy.sh
```

### Manual Deployment
1. Install prerequisites (AWS CLI, Node.js, Docker)
2. Configure AWS credentials
3. Deploy infrastructure with CDK
4. Set up Bedrock Agent
5. Build and deploy frontend
6. Configure monitoring

### First Steps After Deployment
1. Verify SES email address for notifications
2. Create Cognito admin user
3. Add test molecules to watchlist
4. Monitor ingestion pipeline
5. Review daily digest emails

## 📚 Documentation

- **[README.md](./README.md)**: Quick start guide
- **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)**: Detailed architecture
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**: Step-by-step deployment
- **Individual component READMEs**: Component-specific documentation

## 🤝 Contributing

### Development Workflow
1. Fork repository
2. Create feature branch
3. Implement changes with tests
4. Submit pull request
5. Automated CI/CD deployment

### Code Standards
- **TypeScript**: Infrastructure code
- **Python 3.11**: Lambda functions
- **React 18**: Frontend components
- **Material-UI**: UI components
- **ESLint/Prettier**: Code formatting

This project provides a complete, production-ready competitive intelligence system that can be deployed and scaled on AWS with minimal manual intervention.