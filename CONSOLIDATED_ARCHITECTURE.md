# CI Alert System - Unified Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CI ALERT SYSTEM                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      CI/CD LAYER                                             │
│  Developer → GitHub → GitHub Actions → ECR/S3 → CodePipeline → CDK → CloudFormation         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND LAYER                                            │
│                                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐  │
│  │     WAF     │───▶│   Route53   │───▶│     ALB     │───▶│    ECS Fargate (React)      │  │
│  │ Protection  │    │     DNS     │    │    HTTPS    │    │      Frontend UI            │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     API LAYER                                               │
│                                                                                              │
│  ┌─────────────────────────────┐              ┌─────────────────────────────────────────┐  │
│  │       API Gateway           │◀────────────▶│         Cognito User Pool               │  │
│  │    REST Endpoints           │              │      JWT Authentication                 │  │
│  └─────────────────────────────┘              └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  LAMBDA FUNCTIONS                                           │
│                                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  Ingestion  │  │  Processor  │  │   Insight   │  │ Watchlist   │  │   Agent     │      │
│  │   Lambda    │  │   Lambda    │  │   Lambda    │  │   Lambda    │  │  Lambda     │      │
│  │             │  │             │  │             │  │             │  │             │      │
│  │ Fetch Data  │  │ AI Analysis │  │Query Insights│  │Manage Lists │  │ AI Chat/RAG │      │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                                                              │
│                              ┌─────────────┐                                               │
│                              │   Digest    │                                               │
│                              │   Lambda    │                                               │
│                              │             │                                               │
│                              │Daily Emails │                                               │
│                              └─────────────┘                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DATA STORAGE                                              │
│                                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  DynamoDB   │  │     S3      │  │ OpenSearch  │  │  Bedrock    │  │ EventBridge │      │
│  │             │  │             │  │             │  │             │  │             │      │
│  │ • Insights  │  │ • Raw Data  │  │ • Vector DB │  │ • Claude AI │  │ • Schedulers│      │
│  │ • Watchlist │  │ • Knowledge │  │ • Embeddings│  │ • Embeddings│  │ • Triggers  │      │
│  │ • Settings  │  │   Base      │  │ • Search    │  │ • Models    │  │             │      │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                                                              │
│                    ┌─────────────┐              ┌─────────────┐                           │
│                    │     SQS     │              │     SES     │                           │
│                    │             │              │             │                           │
│                    │ • Message   │              │ • Email     │                           │
│                    │   Queue     │              │   Delivery  │                           │
│                    │ • Batching  │              │ • Digest    │                           │
│                    └─────────────┘              └─────────────┘                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              MONITORING & SECURITY                                          │
│                                                                                              │
│  ┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │           OBSERVABILITY                 │  │             SECURITY                    │  │
│  │                                         │  │                                         │  │
│  │ • CloudWatch (Logs + Metrics + Alarms) │  │ • WAF (Rate Limiting + OWASP Rules)    │  │
│  │ • X-Ray Tracing                         │  │ • Cognito (JWT + MFA)                  │  │
│  │ • CloudTrail Audit                      │  │ • IAM (Least Privilege)                │  │
│  │ • SNS Notifications                     │  │ • VPC (Network Isolation)              │  │
│  │                                         │  │ • Encryption (At Rest + In Transit)    │  │
│  │                                         │  │ • Secrets Manager                      │  │
│  └─────────────────────────────────────────┘  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATA FLOWS                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

1. INGESTION: External APIs → EventBridge → Ingestion Lambda → SQS → Processor Lambda → Storage
2. USER REQUEST: User → WAF → ALB → ECS → API Gateway → Cognito → Lambda → Storage → Response
3. DIGEST: EventBridge → Digest Lambda → DynamoDB + Bedrock → SES → Email
4. AI CHAT: User → Agent Lambda → OpenSearch + S3 + Bedrock → Response
```



## Lambda Functions
| Function | Purpose | Shared Services |
|----------|---------|-----------------|
| **Ingestion Lambda** | Fetch external data | EventBridge, SQS |
| **Processor Lambda** | AI analysis | SQS, DynamoDB, S3, OpenSearch, Bedrock |
| **Insight Lambda** | Query insights | API Gateway, DynamoDB |
| **Watchlist Lambda** | Manage watchlists | API Gateway, DynamoDB |
| **Agent Lambda** | AI chat/RAG | API Gateway, OpenSearch, S3, Bedrock |
| **Digest Lambda** | Daily emails | EventBridge, DynamoDB, Bedrock, SES |

## Shared AWS Services
- **DynamoDB**: Used by Processor, Insight, Watchlist, Digest Lambdas
- **S3**: Used by Processor, Agent Lambdas
- **OpenSearch**: Used by Processor, Agent Lambdas  
- **Bedrock**: Used by Processor, Agent, Digest Lambdas
- **EventBridge**: Used by Ingestion, Digest Lambdas
- **API Gateway**: Used by Insight, Watchlist, Agent Lambdas

## Monitoring & Security
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          OBSERVABILITY STACK                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

CloudWatch (Logs + Metrics + Alarms) → SNS → Email/Slack
X-Ray Tracing → Performance Analysis
CloudTrail → Security Audit

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            SECURITY STACK                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

WAF → Rate Limiting + OWASP Rules
Cognito → JWT Authentication + MFA
IAM → Least Privilege Access
VPC → Network Isolation
Encryption → At Rest + In Transit
Secrets Manager → API Keys + Credentials
```

## Cost Optimization
- **Shared Services**: Single DynamoDB, S3, OpenSearch, Bedrock instances
- **Lambda Concurrency**: Shared across all functions
- **EventBridge**: Single scheduler for multiple triggers
- **Monitoring**: Unified CloudWatch dashboard

## Deployment
```
CDK Stack → All Services Provisioned Together
├── Core Stack (DynamoDB, S3, Lambda, API Gateway, Cognito)
├── AI Stack (Bedrock, OpenSearch)
├── Frontend Stack (ECS, ALB, WAF)
└── Monitoring Stack (CloudWatch, SNS)
```