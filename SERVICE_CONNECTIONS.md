# CI Alert System - Service Connection Map

## Simple Service-to-Service Connections

```
USER → Cloudflare → ALB → ECS → API Gateway → Lambda → DynamoDB
                                     ↓
                                 Bedrock AI
                                     ↓
                               OpenSearch + S3
```

---

## Detailed Connection Matrix

### 1. **User Access Flow** 
```
User Browser
    ↓ HTTPS
Cloudflare CDN (Port 443)
    ↓ HTTPS
Application Load Balancer (Port 443)
    ↓ HTTP (Port 8080)
ECS Fargate Container (React App)
    ↓ HTTPS API Calls
API Gateway (REST API)
    ↓ JWT Validation
Cognito User Pool
    ↓ Authorized Request
Lambda Functions
```

### 2. **Data Ingestion Flow**
```
EventBridge Scheduler (Cron: 0 0 * * ? *)
    ↓ Triggers
PubMed/ClinicalTrials/FDA Lambda Functions
    ↓ HTTPS API Calls
External APIs (PubMed, ClinicalTrials.gov, FDA)
    ↓ JSON Response
SQS Processing Queue
    ↓ Batch Messages (10)
Processor Lambda Function
    ↓ HTTPS API Calls
AWS Bedrock (Claude 3.5 Haiku)
    ↓ AI Analysis Results
DynamoDB InsightsTable + S3 Bucket
```

### 3. **AI Chat Flow**
```
React Chat Component
    ↓ POST /agent
API Gateway
    ↓ JWT Auth
Cognito User Pool
    ↓ Authorized
Agent Lambda Function
    ↓ InvokeAgent API
Bedrock Agent (Claude 3.5 Sonnet)
    ↓ RetrieveAndGenerate
Knowledge Base (S3 + OpenSearch)
    ↓ Vector Search
OpenSearch Serverless
    ↓ Document Results
Bedrock Agent Response
    ↓ JSON Response
React Chat UI
```

### 4. **Daily Digest Flow**
```
EventBridge Scheduler (Cron: 0 9 * * ? *)
    ↓ Triggers
Digest Lambda Function
    ↓ Query
UserSettingsTable (DynamoDB)
    ↓ User List
WatchlistTable (DynamoDB)
    ↓ User Molecules
InsightsTable (DynamoDB)
    ↓ Recent Insights
Bedrock (Claude 3.5 Haiku)
    ↓ AI Summary
Amazon SES
    ↓ SMTP
User Email Inbox
```

---

## Service Connection Details

### **Frontend Connections**
| From | To | Protocol | Port | Purpose |
|------|----|---------|----|---------|
| User Browser | Cloudflare | HTTPS | 443 | Web access |
| Cloudflare | ALB | HTTPS | 443 | Origin requests |
| ALB | ECS Tasks | HTTP | 8080 | Load balancing |
| React App | API Gateway | HTTPS | 443 | API calls |

### **API Layer Connections**
| From | To | Protocol | Port | Purpose |
|------|----|---------|----|---------|
| API Gateway | Cognito | HTTPS | 443 | JWT validation |
| API Gateway | Lambda Functions | Event | N/A | Function invocation |
| Lambda Functions | DynamoDB | HTTPS | 443 | Database operations |
| Lambda Functions | Bedrock | HTTPS | 443 | AI model calls |
| Lambda Functions | S3 | HTTPS | 443 | File operations |
| Lambda Functions | SES | HTTPS | 443 | Email sending |

### **Data Processing Connections**
| From | To | Protocol | Port | Purpose |
|------|----|---------|----|---------|
| EventBridge | Lambda Functions | Event | N/A | Scheduled triggers |
| Ingestion Lambdas | External APIs | HTTPS | 443 | Data fetching |
| Ingestion Lambdas | SQS | HTTPS | 443 | Message queuing |
| SQS | Processor Lambda | Event | N/A | Batch processing |
| Processor Lambda | Bedrock | HTTPS | 443 | AI analysis |
| Processor Lambda | DynamoDB | HTTPS | 443 | Data storage |
| Processor Lambda | S3 | HTTPS | 443 | Document storage |

### **AI/ML Connections**
| From | To | Protocol | Port | Purpose |
|------|----|---------|----|---------|
| Agent Lambda | Bedrock Agent | HTTPS | 443 | Agent invocation |
| Bedrock Agent | Knowledge Base | Internal | N/A | RAG queries |
| Knowledge Base | S3 | Internal | N/A | Document retrieval |
| Knowledge Base | OpenSearch | Internal | N/A | Vector search |
| Processor Lambda | Titan Embeddings | HTTPS | 443 | Vector generation |

### **Storage Connections**
| From | To | Protocol | Port | Purpose |
|------|----|---------|----|---------|
| All Lambdas | DynamoDB | HTTPS | 443 | CRUD operations |
| Processor Lambda | S3 Data Bucket | HTTPS | 443 | Raw data storage |
| Knowledge Base | S3 KB Bucket | Internal | N/A | Document indexing |
| OpenSearch | S3 | Internal | N/A | Vector storage |

### **Network Infrastructure Connections**
| From | To | Protocol | Port | Purpose |
|------|----|---------|----|---------|
| Public Subnets | Internet Gateway | All | All | Internet access |
| Private Subnets | NAT Gateway | All | All | Outbound internet |
| ECS Tasks | ALB Target Group | HTTP | 8080 | Health checks |
| Lambda (VPC) | VPC Endpoints | HTTPS | 443 | AWS service access |

---

## Connection Security

### **Authentication & Authorization**
```
User → Cognito User Pool (JWT Token)
    ↓
API Gateway (Cognito Authorizer)
    ↓
Lambda Functions (Authorized Context)
    ↓
AWS Services (IAM Roles)
```

### **Network Security**
```
Internet → Cloudflare WAF → ALB WAF → Security Groups → Services
```

### **Data Encryption**
```
In Transit: TLS 1.3 (Cloudflare) → TLS 1.2+ (AWS)
At Rest: AES-256 (DynamoDB, S3, OpenSearch)
```

---

## Service Dependencies

### **Critical Path Dependencies**
1. **User Access:** Cloudflare → ALB → ECS → API Gateway → Cognito
2. **Data Processing:** EventBridge → Lambda → SQS → Processor → Bedrock → DynamoDB
3. **AI Chat:** API Gateway → Agent Lambda → Bedrock Agent → Knowledge Base → OpenSearch
4. **Email Digest:** EventBridge → Digest Lambda → DynamoDB → Bedrock → SES

### **Service Failure Impact**
| Service Down | Impact | Workaround |
|--------------|--------|------------|
| Cloudflare | No web access | Direct ALB access |
| ALB | No frontend | API still works |
| ECS | No UI | API endpoints available |
| API Gateway | No API access | Direct Lambda (dev only) |
| Cognito | No authentication | System unusable |
| DynamoDB | No data access | System unusable |
| Bedrock | No AI features | Cached responses only |
| S3 | No file storage | Core features work |
| OpenSearch | No vector search | Basic search only |
| SES | No email | System works, no notifications |

---

## Data Flow Patterns

### **Synchronous Flows**
```
User Request → API Gateway → Lambda → DynamoDB → Response (< 1 second)
User Chat → API Gateway → Agent Lambda → Bedrock → Response (< 5 seconds)
```

### **Asynchronous Flows**
```
EventBridge → Ingestion Lambda → SQS → Processor Lambda → Storage (minutes)
EventBridge → Digest Lambda → Email Generation → SES → Delivery (minutes)
```

### **Batch Processing**
```
SQS Queue (1,500 messages) → Processor Lambda (batch 10) → Bedrock → DynamoDB
```

---

## Connection Monitoring

### **Health Check Endpoints**
- **ALB → ECS:** `GET /health` (30s interval)
- **API Gateway:** Built-in health monitoring
- **Lambda Functions:** CloudWatch metrics
- **DynamoDB:** CloudWatch metrics
- **Bedrock:** Service health dashboard

### **Connection Metrics**
- **Response Times:** p50, p95, p99 for each connection
- **Error Rates:** 4xx, 5xx errors per service
- **Throughput:** Requests per second per connection
- **Availability:** Uptime percentage per service

### **Alerting Thresholds**
- **API Gateway 5xx > 10 in 5 minutes**
- **Lambda errors > 5 in 5 minutes**
- **DynamoDB throttling > 10 events**
- **ALB unhealthy targets > 0 for 2 minutes**

---

## Connection Optimization

### **Performance Optimizations**
1. **Connection Pooling:** Lambda to DynamoDB/Bedrock
2. **Keep-Alive:** HTTP connections where possible
3. **Caching:** Cloudflare edge caching for static assets
4. **Compression:** Gzip/Brotli for API responses
5. **CDN:** Cloudflare for global content delivery

### **Cost Optimizations**
1. **ARM64 Lambda:** 20% cost savings vs x86
2. **On-Demand DynamoDB:** Pay per request
3. **S3 Lifecycle:** Move old data to Glacier
4. **Reserved Capacity:** For predictable workloads
5. **Spot Instances:** For non-critical batch processing

---

## Simple Connection Summary

**Every service connects to every other service through these patterns:**

1. **User → Frontend:** Cloudflare → ALB → ECS
2. **Frontend → API:** HTTPS to API Gateway
3. **API → Auth:** Cognito JWT validation
4. **API → Compute:** Lambda function invocation
5. **Compute → AI:** Bedrock API calls
6. **Compute → Storage:** DynamoDB/S3 operations
7. **Scheduler → Processing:** EventBridge triggers
8. **Processing → Queue:** SQS messaging
9. **Queue → AI:** Batch processing
10. **AI → Knowledge:** Vector search + retrieval

**All connections use HTTPS/TLS encryption and IAM role-based authentication.**