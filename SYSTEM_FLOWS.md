# CI Alert System - How Components Work Together

## 🔄 FLOW 1: DATA INGESTION (Daily at Midnight)
```
External APIs (PubMed/FDA) ──┐
                             │
                             ▼
                    EventBridge Scheduler ──▶ Ingestion Lambda ──▶ SQS Queue
                                                                        │
                                                                        ▼
                                                              Processor Lambda
                                                                        │
                                                                        ▼
                                              ┌─────────────────────────┼─────────────────────────┐
                                              ▼                         ▼                         ▼
                                        DynamoDB                      S3                   OpenSearch
                                      (Insights)                 (Raw Data)              (Embeddings)
                                              │                         │                         │
                                              └─────────────────────────┼─────────────────────────┘
                                                                        ▼
                                                                  Bedrock AI
                                                               (Analysis & Summary)
```

## 🔄 FLOW 2: USER REQUESTS (Real-time)
```
User Browser ──▶ WAF ──▶ ALB ──▶ ECS (React) ──▶ API Gateway ──▶ Cognito Auth
                                                                        │
                                                                        ▼
                                                              Lambda Functions
                                                    ┌─────────────┼─────────────┐
                                                    ▼             ▼             ▼
                                              Insight       Watchlist       Agent
                                              Lambda        Lambda          Lambda
                                                    │             │             │
                                                    ▼             ▼             ▼
                                              DynamoDB      DynamoDB    OpenSearch+S3+Bedrock
                                              (Query)       (CRUD)         (RAG Chat)
                                                    │             │             │
                                                    └─────────────┼─────────────┘
                                                                  ▼
                                                            JSON Response
                                                                  │
                                                                  ▼
                                                            User Interface
```

## 🔄 FLOW 3: DAILY DIGEST (9 AM UTC)
```
EventBridge Scheduler ──▶ Digest Lambda
                                │
                                ▼
                    ┌───────────┼───────────┐
                    ▼                       ▼
              DynamoDB                 Bedrock AI
           (User Settings +           (Generate
            Watchlists +              Summary)
             Insights)                    │
                    │                     │
                    └─────────────────────┘
                                │
                                ▼
                          SES Email ──▶ User Inbox
```

## 🔄 FLOW 4: AI CHAT (Interactive)
```
User Question ──▶ Agent Lambda
                        │
                        ▼
              ┌─────────┼─────────┐
              ▼                   ▼
        OpenSearch           S3 Knowledge Base
      (Vector Search)        (Documents)
              │                   │
              └─────────┼─────────┘
                        ▼
                  Bedrock Agent
                 (RAG + Context)
                        │
                        ▼
                  AI Response ──▶ User Chat
```

## 🔄 SHARED SERVICES INTEGRATION
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ DynamoDB    │ All Lambdas read/write insights, watchlists, user settings              │
│ S3          │ Processor stores raw data, Agent reads knowledge base documents         │
│ OpenSearch  │ Processor creates embeddings, Agent performs vector search             │
│ Bedrock     │ Processor analyzes data, Agent chats, Digest summarizes               │
│ EventBridge │ Triggers Ingestion (midnight) and Digest (9 AM) automatically         │
│ API Gateway │ Routes all user requests to appropriate Lambda functions               │
│ Cognito     │ Authenticates all API calls with JWT tokens                           │
│ SQS         │ Buffers ingestion data for reliable processing                         │
│ SES         │ Delivers daily digest emails to users                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Service Dependencies

| Lambda Function | Reads From | Writes To | Triggers |
|-----------------|------------|-----------|----------|
| **Ingestion Lambda** | External APIs | SQS | EventBridge (midnight) |
| **Processor Lambda** | SQS | DynamoDB, S3, OpenSearch | SQS messages |
| **Insight Lambda** | DynamoDB | - | API Gateway |
| **Watchlist Lambda** | DynamoDB | DynamoDB | API Gateway |
| **Agent Lambda** | OpenSearch, S3 | - | API Gateway |
| **Digest Lambda** | DynamoDB | SES | EventBridge (9 AM) |

## Data Flow Summary

1. **Midnight**: EventBridge triggers data ingestion from external APIs
2. **Processing**: SQS queues data for AI analysis and storage
3. **Real-time**: Users interact via React frontend with authenticated API calls
4. **AI Chat**: Agent Lambda provides RAG-powered responses using vector search
5. **Morning**: EventBridge triggers daily digest emails with AI summaries
6. **Monitoring**: All activities logged and monitored via CloudWatch