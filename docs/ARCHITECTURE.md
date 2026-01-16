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

================================================================================================

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

================================================================================================

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

================================================================================================

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

================================================================================================

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DAILY DIGEST PIPELINE                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

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

================================================================================================

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  OBSERVABILITY & SECURITY                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

CloudWatch Logs • CloudWatch Metrics • X-Ray Traces  
CloudTrail Audit • SNS Alarms • Bedrock Metrics  
OpenSearch Trace Logs • DynamoDB Throttles  
WAF Analytics • ECS Container Insights

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SECURITY LAYERS                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

• WAF Protection (Rate limiting, OWASP rules, DDoS protection)
• Cognito Authentication (JWT tokens, MFA support)
• IAM Least Privilege (Role-based access control)
• VPC Security Groups (Network isolation)
• S3/DynamoDB Encryption (At rest and in transit)
• Secrets Manager (API keys and credentials)
• CloudTrail Logging (All API calls audited)────────────────────────────────────────────────────────────────────────────────┘

CloudWatch Logs • CloudWatch Metrics • X-Ray Traces  
CloudTrail Audit • SNS Alarms • Bedrock Metrics  
OpenSearch Trace Logs • DynamoDB Throttles  
Cloudflare Analytics (Edge security + traffic)

