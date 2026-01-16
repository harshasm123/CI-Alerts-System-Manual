# CI Alert System - Architecture

## CI/CD Pipeline
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      CI / CD PIPELINE                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────┐      ┌────────────────────────┐      ┌───────────────────────────────┐
│   Developer (Code)   │ ───▶ │    GitHub Repo         │ ───▶ │    GitHub Actions (CI/CD)     │
└──────────────────────┘      └────────────────────────┘      │ Build • Test • Deploy • Auto  │
                                                               └───────────┬───────────────────┘
                                                                           │ Automated Pipeline
                                                           ┌───────────────┼──────────────────────┐
                                                           ▼                                      ▼
                                                ┌──────────────────────┐                ┌─────────────────────┐
                                                │  ECR (Docker Images) │                │  S3 (Lambda Zips)   │
                                                └──────────────┬───────┘                └──────────┬──────────┘
                                                               ▼                                   ▼
                                                 ┌───────────────────────────┐
                                                 │   GitHub Actions Deploy   │
                                                 └──────────────┬────────────┘
                                                                ▼
                                              ┌──────────────────────────────────┐
                                              │     Auto CloudFormation         │
                                              │ Provisions ALL AWS resources     │
                                              └──────────────────────────────────┘
```

## Application Runtime Pipeline
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  APPLICATION / RUNTIME PIPELINE                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                   ┌────────────────────────┐
                   │   Cloudflare (Dynamic)  │
                   │   WAF + CDN + SSL       │
                   └───────────┬────────────┘
                               │ HTTPS Requests
                               ▼
                      ┌──────────────────┐
                      │      ALB (HTTPS) │
                      └─────────┬────────┘
                                │ Load Balance
                                ▼
              ┌────────────────────────────────────────────────┐
              │        ECS Fargate (React Frontend)            │
              │       Serves UI + Makes API Calls              │
              └───────────────┬────────────────────────────────┘
                              │ REST API Calls
                              ▼
                 ┌───────────────────────────┐
                 │       API Gateway          │
                 └────────────┬───────────────┘
                              │ JWT Validation
                              ▼
               ┌──────────────────────────────┐
               │     Cognito User Pool (Auth) │
               └──────────────┬───────────────┘
                              │ Authorized Requests
                              ▼
               ┌─────────────────────────────────────────────────────┐
               │               Lambda API Tier                       │
               │ Insights • Watchlist • Settings • Agent • Core     │
               └───────────────┬────────────┬─────────────┬─────────┘
                               │ Query/Write │ Store/Read  │ Vector Search
                               ▼            ▼             ▼
               ┌────────────────────┐  ┌───────────────┐  ┌─────────────────────┐
               │     DynamoDB       │  │       S3       │  │  OpenSearch Vector  │
               │  Insights + Config │  │  KB / Raw Data │  │    Retrieval Index  │
               └────────────────────┘  └───────────────┘  └─────────────────────┘
                               │ Data Read    │ Documents   │ Embeddings
                               └────────────┼─────────────┘
                                            │ AI Processing
                                            ▼
                           ┌──────────────────────────────────┐
                           │       AWS Bedrock (LLM)          │
                           │ Claude Sonnet • Haiku • Embeds   │
                           └──────────────────────────────────┘
                                            │ AI Responses
                                            ▼
                 ┌────────────────────────────────────────────────────┐
                 │ USER → Cloudflare → ALB → ECS → API Gateway → Lambda │
                 └────────────────────────────────────────────────────┘
```

## Data Pipeline (ETL + AI)
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     DATA PIPELINE (ETL + AI)                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────┐
     │ External Data Sources        │
     │ PubMed • Trials • FDA • EMA  │
     └─────────────┬────────────────┘
                   │ API Calls
                   ▼
     ┌──────────────────────────────┐
     │  EventBridge (Schedulers)    │
     └─────────────┬────────────────┘
                   │ Cron Trigger (Midnight)
                   ▼
     ┌──────────────────────────────┐
     │ Ingestion Lambdas            │
     │ Fetch Raw Documents          │
     └─────────────┬────────────────┘
                   │ Raw Data Messages
                   ▼
     ┌──────────────────────────────┐
     │        SQS Queue             │
     │ Batches for Processing       │
     └─────────────┬────────────────┘
                   │ Batch Messages
                   ▼
     ┌──────────────────────────────┐
     │      Processor Lambda        │
     │ Summaries + Embeddings + ETL │
     └─────────────┬───────┬────────┘
                   │ Store │ Store
                   ▼       ▼
           ┌────────────┐ ┌──────────────┐ ┌─────────────────────────┐
           │   S3       │ │   DynamoDB    │ │   OpenSearch Vector DB  │
           │ Raw+Cleaned│ │ Insights Data │ │   Embeddings & Metadata │
           └────────────┘ └──────────────┘ └─────────────────────────┘
                               │ Query Data
                               ▼
                    ┌──────────────────────────────┐
                    │  AI Pipeline (RAG Retrieval)  │
                    └──────────────────────────────┘
```

## AI Pipeline (RAG + LLM Agent)
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                               AI PIPELINE (RAG + LLM AGENT)                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

              ┌──────────────────────────────┐
              │       Agent Lambda           │
              └───────────────┬──────────────┘
                               │ User Query
                               ▼
       ┌──────────────────────────────┬──────────────────────────────┬───────────────────────┐
       │ Vector Search                │ Document Retrieval           │ AI Processing
       ▼                              ▼                              ▼
OpenSearch (Vector Search)     S3 (KB Docs)                 Bedrock (Sonnet/Haiku)
       │ Embeddings                   │ Raw Documents                │ Context + Query
       ▼                              ▼                              ▼
       └──────────────────────────────┴───────────────→ Construct RAG Context
                                                      │ Combined Context
                                                      ▼
                                        ┌───────────────────────────┐
                                        │   Bedrock Final Answer    │
                                        └───────────────────────────┘
                                                      │ AI Response
                                                      ▼
                                        Returned through API → User
```

## Daily Digest Pipeline
```
EventBridge (Daily Cron)
         │ 9 AM UTC Trigger
         ▼
Digest Lambda
         ├── Query User Data ──▶ DynamoDB (Insights + Watchlists)
         ├── Generate Summary ──▶ Bedrock Haiku (Summary)
         └── Send Email ──▶ SES (Email Delivery)
                  │ HTML Email
                  ▼
              User Email Inbox
```

## System Components

### Lambda Functions
- **Ingestion Lambda** - Fetch data from PubMed, FDA, etc.
- **Processor Lambda** - AI analysis with Claude 3.5 Haiku
- **Insight Lambda** - Get/query insights data
- **Watchlist Lambda** - Manage user watchlists
- **Agent Lambda** - AI chat with RAG queries
- **Digest Lambda** - Daily email summaries

### Storage
- **DynamoDB** - Insights, watchlists, user settings
- **S3** - Raw documents, knowledge base files
- **OpenSearch** - Vector embeddings for RAG

### AI Models
- **Claude Haiku** - Fast, cheap processing ($0.50/month)
- **Claude Sonnet** - Advanced analysis ($44/month)
- **Titan Embeddings** - Vector search ($15/month)

## Data Flow Summary

1. **Midnight**: EventBridge triggers data ingestion from external APIs
2. **Processing**: SQS queues data for AI analysis and storage
3. **Real-time**: Users interact via React frontend with authenticated API calls
4. **AI Chat**: Agent Lambda provides RAG-powered responses using vector search
5. **Morning**: EventBridge triggers daily digest emails with AI summaries
6. **Monitoring**: All activities logged and monitored via CloudWatch