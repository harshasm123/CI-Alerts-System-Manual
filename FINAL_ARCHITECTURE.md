# CI Alert System - Final Production Architecture

## Complete System Architecture with CloudFront

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CI/CD DEPLOYMENT PIPELINE                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

    Developer                GitHub                 GitHub Actions
    Commits Code    ───▶    Repository     ───▶    CI/CD Pipeline
        │                       │                        │
        │                       │                        ├─── Build & Test
        │                       │                        ├─── Security Scan
        │                       │                        └─── Package Artifacts
        │                       │                                │
        │                       │                    ┌───────────┴───────────┐
        │                       │                    ▼                       ▼
        │                       │            ECR (Docker Images)     S3 (Lambda Packages)
        │                       │                    │                       │
        │                       │                    └───────────┬───────────┘
        │                       │                                ▼
        │                       │                    GitHub Actions Deploy
        │                       │                                │
        │                       │                                ▼
        │                       │                    AWS CloudFormation (IaC)
        │                       │                                │
        │                       │                                ├─── Provisions Infrastructure
        │                       │                                ├─── Updates Services
        │                       │                                └─── Configures Security
        │                       │                                        │
        └───────────────────────┴────────────────────────────────────────┘
                                                                         │
                                                    Deploys All Components Below ▼

════════════════════════════════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              USER REQUEST FLOW (FRONTEND + API)                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

    End User (Browser)
         │
         │ HTTPS Request
         ▼
    ┌─────────────────────────┐
    │   Cloudflare (Layer 1)  │ ◄─── Global CDN + WAF Protection
    │  • DDoS Protection      │      • Rate Limiting: 1000 req/min
    │  • WAF Rules (OWASP)    │      • SSL/TLS Termination
    │  • Bot Detection        │      • Geographic Filtering
    └────────────┬────────────┘
                 │ Filtered HTTPS Traffic
                 ▼
    ┌─────────────────────────┐
    │   Route 53 (DNS)        │ ◄─── DNS Resolution
    │  • Health Checks        │      • Failover Routing
    │  • Latency Routing      │      • Multi-Region Support
    └────────────┬────────────┘
                 │ Routed Request
                 ▼
    ┌─────────────────────────┐
    │  CloudFront (Layer 2)   │ ◄─── Content Delivery Network
    │  • Edge Caching         │      • Static Asset Delivery
    │  • HTTPS Enforcement    │      • Origin Shield
    │  • Compression          │      • Custom Headers
    └────────────┬────────────┘
                 │ Cached/Proxied Request
                 ▼
    ┌─────────────────────────┐
    │  ALB (Layer 3)          │ ◄─── Application Load Balancer
    │  • Health Checks        │      • SSL Termination
    │  • Path-Based Routing   │      • Sticky Sessions
    │  • Auto-Scaling         │      • Connection Draining
    └────────────┬────────────┘
                 │ Load Balanced
                 │
         ┌───────┴────────┐
         ▼                ▼
    ┌──────────┐    ┌──────────┐
    │ ECS Task │    │ ECS Task │  ◄─── React Frontend (2-10 tasks)
    │ (React)  │    │ (React)  │       • Material-UI Dashboard
    │ Port 80  │    │ Port 80  │       • Real-time Updates
    └────┬─────┘    └────┬─────┘       • Interactive Charts
         │               │
         └───────┬───────┘
                 │ API Calls (REST)
                 ▼
    ┌─────────────────────────┐
    │   API Gateway           │ ◄─── RESTful API Layer
    │  • Request Validation   │      • Throttling: 10K req/sec
    │  • CORS Configuration   │      • Request/Response Transform
    │  • Usage Plans          │      • API Keys Management
    └────────────┬────────────┘
                 │ JWT Token Validation
                 ▼
    ┌─────────────────────────┐
    │   Cognito Authorizer    │ ◄─── Authentication & Authorization
    │  • JWT Verification     │      • User Pool Management
    │  • MFA Support          │      • OAuth 2.0 / OIDC
    │  • Session Management   │      • Password Policies
    └────────────┬────────────┘
                 │ Authorized Request
                 ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    Lambda Functions (API Tier)              │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
    │  │ Insights │  │Watchlist │  │ Settings │  │  Agent   │  │
    │  │   API    │  │   API    │  │   API    │  │   API    │  │
    │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
    └───────┼─────────────┼─────────────┼─────────────┼─────────┘
            │             │             │             │
            │ Read/Write  │ CRUD Ops    │ Config      │ AI Query
            ▼             ▼             ▼             ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  DynamoDB    │ │      S3      │ │  OpenSearch  │
    │  • Insights  │ │  • Documents │ │  • Vectors   │
    │  • Users     │ │  • Raw Data  │ │  • Metadata  │
    │  • Settings  │ │  • Processed │ │  • Embeddings│
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           └────────────────┼────────────────┘
                            │ Data for AI Processing
                            ▼
                   ┌─────────────────┐
                   │  AWS Bedrock    │ ◄─── AI/ML Services
                   │  • Claude 3.5   │      • Sonnet (Chat)
                   │  • Haiku (Batch)│      • Haiku (Processing)
                   │  • Embeddings   │      • Titan Embeddings
                   └─────────────────┘
                            │
                            │ AI Response
                            ▼
                   Response Path (Reverse)
                   Lambda → API Gateway → ALB → CloudFront → User

════════════════════════════════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           DATA INGESTION & PROCESSING PIPELINE                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

    External Data Sources
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │  PubMed  │  │  Trials  │  │   FDA    │  │   EMA    │
    └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
         │             │             │             │
         └─────────────┴─────────────┴─────────────┘
                       │ API Calls
                       ▼
         ┌──────────────────────────┐
         │  EventBridge Scheduler   │ ◄─── Automated Triggers
         │  • Daily: 00:00 UTC      │      • Ingestion Schedule
         │  • Digest: 09:00 UTC     │      • Health Checks: 5min
         │  • Health: Every 5min    │      • Retry Logic
         └────────────┬─────────────┘
                      │ Cron Trigger
                      ▼
         ┌──────────────────────────┐
         │  Ingestion Lambda        │ ◄─── Data Collection
         │  • Fetch Documents       │      • API Integration
         │  • Validate Data         │      • Error Handling
         │  • Transform Format      │      • Rate Limiting
         └────────────┬─────────────┘
                      │ Raw Data Messages
                      ▼
         ┌──────────────────────────┐
         │  SQS Queue (FIFO)        │ ◄─── Message Queue
         │  • Batch Processing      │      • Dead Letter Queue
         │  • Retry Policy          │      • Visibility Timeout
         │  • Message Deduplication │      • Max Receives: 3
         └────────────┬─────────────┘
                      │ Batch Messages (10 items)
                      ▼
         ┌──────────────────────────┐
         │  Processor Lambda        │ ◄─── AI Processing
         │  • Claude Haiku (Batch)  │      • Summarization
         │  • Generate Embeddings   │      • Entity Extraction
         │  • Extract Metadata      │      • Classification
         │  • Quality Validation    │      • Deduplication
         └────────────┬─────────────┘
                      │ Processed Data
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    ┌────────┐  ┌──────────┐  ┌──────────────┐
    │   S3   │  │ DynamoDB │  │  OpenSearch  │
    │ Store  │  │  Store   │  │    Index     │
    │ Raw +  │  │ Insights │  │  Embeddings  │
    │Cleaned │  │   Data   │  │  + Metadata  │
    └────────┘  └──────────┘  └──────────────┘
         │            │            │
         └────────────┼────────────┘
                      │ Available for Queries
                      ▼
              Ready for User Access

════════════════════════════════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              AI/RAG PIPELINE (INTELLIGENT SEARCH)                              │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

    User Query (via Chat Interface)
         │
         │ "What are the latest trials for Drug X?"
         ▼
    ┌─────────────────────────┐
    │   Agent Lambda          │ ◄─── Orchestration Layer
    │  • Query Understanding  │      • Intent Recognition
    │  • Context Building     │      • Session Management
    │  • Response Generation  │      • Citation Tracking
    └────────────┬────────────┘
                 │ Parallel Processing
                 │
    ┌────────────┼────────────┬────────────────────┐
    │            │            │                    │
    ▼            ▼            ▼                    ▼
┌─────────┐ ┌─────────┐ ┌─────────┐      ┌──────────────┐
│OpenSearch│ │   S3    │ │DynamoDB │      │   Bedrock    │
│ Vector  │ │Document │ │ User    │      │   Claude     │
│ Search  │ │Retrieval│ │ Context │      │   Sonnet     │
└────┬────┘ └────┬────┘ └────┬────┘      └──────┬───────┘
     │           │           │                   │
     │ Top 5     │ Full      │ User              │ Query
     │ Results   │ Documents │ Preferences       │ Processing
     │           │           │                   │
     └───────────┴───────────┴───────────────────┘
                             │
                             │ Combined Context
                             ▼
                    ┌─────────────────┐
                    │  RAG Context    │ ◄─── Context Assembly
                    │  • Relevant Docs│      • Ranking
                    │  • User History │      • Deduplication
                    │  • Metadata     │      • Relevance Scoring
                    └────────┬────────┘
                             │ Enriched Context
                             ▼
                    ┌─────────────────┐
                    │  Bedrock Agent  │ ◄─── AI Generation
                    │  • Generate     │      • Claude 3.5 Sonnet
                    │  • Add Citations│      • Context-Aware
                    │  • Format       │      • Source Attribution
                    └────────┬────────┘
                             │ Final Response
                             ▼
                    ┌─────────────────┐
                    │  Response       │
                    │  • Answer       │
                    │  • Citations    │
                    │  • Confidence   │
                    └────────┬────────┘
                             │
                             ▼
                    Return to User via API Gateway

════════════════════════════════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              DAILY DIGEST EMAIL PIPELINE                                       │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

    EventBridge Scheduler
    (Daily at 09:00 UTC)
         │
         │ Trigger
         ▼
    ┌─────────────────────────┐
    │  Digest Lambda          │ ◄─── Email Generation
    │  • Fetch User Settings  │      • Personalization
    │  • Query Watchlists     │      • Content Filtering
    │  • Get Latest Insights  │      • Template Rendering
    └────────────┬────────────┘
                 │
         ┌───────┼───────┐
         ▼       ▼       ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │DynamoDB│ │DynamoDB│ │DynamoDB│
    │ User   │ │Watch   │ │Insights│
    │Settings│ │ lists  │ │  Data  │
    └───┬────┘ └───┬────┘ └───┬────┘
        │          │          │
        └──────────┼──────────┘
                   │ User Data + Insights
                   ▼
         ┌──────────────────────┐
         │  Bedrock Haiku       │ ◄─── AI Summarization
         │  • Summarize Content │      • Cost-Optimized
         │  • Prioritize Items  │      • Batch Processing
         │  • Generate Insights │      • Personalized
         └──────────┬───────────┘
                    │ AI Summary
                    ▼
         ┌──────────────────────┐
         │  Email Template      │ ◄─── HTML Generation
         │  • Format HTML       │      • Responsive Design
         │  • Add Branding      │      • CTA Buttons
         │  • Include Links     │      • Unsubscribe Link
         └──────────┬───────────┘
                    │ Formatted Email
                    ▼
         ┌──────────────────────┐
         │  AWS SES             │ ◄─── Email Delivery
         │  • Send Email        │      • Bounce Handling
         │  • Track Delivery    │      • Complaint Handling
         │  • Handle Bounces    │      • Reputation Management
         └──────────┬───────────┘
                    │ Delivered
                    ▼
              User Email Inbox
              (300 users daily)

════════════════════════════════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          MONITORING & OBSERVABILITY PIPELINE                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

    All System Components
    (ECS, Lambda, API Gateway, DynamoDB, etc.)
         │
         │ Metrics, Logs, Traces
         ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    CloudWatch (Central Hub)                 │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
    │  │   Logs       │  │   Metrics    │  │   Alarms     │    │
    │  │  • Lambda    │  │  • CPU/Memory│  │  • Latency   │    │
    │  │  • API GW    │  │  • Requests  │  │  • Errors    │    │
    │  │  • ECS       │  │  • Errors    │  │  • Costs     │    │
    │  └──────────────┘  └──────────────┘  └──────┬───────┘    │
    └────────────────────────────────────────────────┼───────────┘
                                                     │
                                         ┌───────────┼───────────┐
                                         ▼           ▼           ▼
                                    ┌────────┐ ┌────────┐ ┌────────┐
                                    │ X-Ray  │ │  SNS   │ │Dashboard│
                                    │ Traces │ │ Alerts │ │ Metrics │
                                    └────────┘ └───┬────┘ └────────┘
                                                   │
                                                   │ Critical Alerts
                                                   ▼
                                            Admin Email/SMS
                                            (Immediate Response)

════════════════════════════════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY LAYERS (DEFENSE IN DEPTH)                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

    Layer 1: Edge Security
    ┌─────────────────────────┐
    │   Cloudflare WAF        │ ◄─── DDoS Protection, Bot Detection, Rate Limiting
    └────────────┬────────────┘
                 │
    Layer 2: Network Security
    ┌─────────────────────────┐
    │   VPC + Security Groups │ ◄─── Network Isolation, Private Subnets
    └────────────┬────────────┘
                 │
    Layer 3: Application Security
    ┌─────────────────────────┐
    │   Cognito + JWT         │ ◄─── Authentication, Authorization, MFA
    └────────────┬────────────┘
                 │
    Layer 4: Data Security
    ┌─────────────────────────┐
    │   Encryption (AES-256)  │ ◄─── At Rest + In Transit (TLS 1.3)
    └────────────┬────────────┘
                 │
    Layer 5: Access Control
    ┌─────────────────────────┐
    │   IAM Least Privilege   │ ◄─── Role-Based Access, Service Policies
    └────────────┬────────────┘
                 │
    Layer 6: Audit & Compliance
    ┌─────────────────────────┐
    │   CloudTrail Logging    │ ◄─── All API Calls Logged, 90-day Retention
    └─────────────────────────┘

════════════════════════════════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  KEY PERFORMANCE METRICS                                       │
└────────────────────────────────────────────────────────────────────────────────────────────────┘

    AVAILABILITY                    PERFORMANCE                     SCALE
    ┌──────────────┐               ┌──────────────┐               ┌──────────────┐
    │  99.9% SLA   │               │ <500ms API   │               │ 300 Users    │
    │  8.77h/year  │               │ <2s Dashboard│               │ 3M Req/month │
    │  Multi-AZ    │               │ <5s AI Chat  │               │ 30K Docs/day │
    └──────────────┘               └──────────────┘               └──────────────┘

    COST                           SECURITY                        AUTOMATION
    ┌──────────────┐               ┌──────────────┐               ┌──────────────┐
    │ $640/month   │               │ 6 Layers     │               │ 80% Reduction│
    │ $2.13/user   │               │ End-to-End   │               │ in Manual    │
    │ 23% Optimized│               │ Encryption   │               │ Operations   │
    └──────────────┘               └──────────────┘               └──────────────┘

════════════════════════════════════════════════════════════════════════════════════════════════
```

## Architecture Highlights

### **Traffic Flow Summary**
1. **User Request**: User → Cloudflare → Route53 → CloudFront → ALB → ECS → API Gateway → Cognito → Lambda
2. **Data Ingestion**: External APIs → EventBridge → Lambda → SQS → Processor → Storage (S3/DynamoDB/OpenSearch)
3. **AI Processing**: User Query → Agent Lambda → RAG (OpenSearch + S3) → Bedrock → Response
4. **Email Digest**: EventBridge → Digest Lambda → Bedrock Haiku → SES → User Email
5. **CI/CD**: GitHub → Actions → ECR/S3 → CloudFormation → All Infrastructure

### **Key Components**
- **CloudFront**: Global CDN for static assets and API caching
- **Cloudflare**: WAF protection and DDoS mitigation
- **ECS Fargate**: Containerized React frontend with auto-scaling
- **API Gateway**: RESTful API with throttling and validation
- **Lambda**: Serverless compute for all business logic
- **Bedrock**: AI/ML services (Claude 3.5 Sonnet/Haiku)
- **OpenSearch**: Vector database for semantic search
- **DynamoDB**: NoSQL database for user data and insights
- **S3**: Object storage for documents and artifacts

### **Production Features**
- ✅ Multi-layer security (6 defense layers)
- ✅ Auto-scaling (2-10 ECS tasks)
- ✅ Global CDN with edge caching
- ✅ Comprehensive monitoring and alerting
- ✅ Automated CI/CD pipeline
- ✅ 99.9% uptime SLA
- ✅ Cost-optimized AI processing
- ✅ Event-driven architecture
