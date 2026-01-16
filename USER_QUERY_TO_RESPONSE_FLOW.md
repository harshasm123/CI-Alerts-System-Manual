# User Query to Response - Complete Service Flow

## Step-by-Step Service Connections

### **Query Flow 1: Get Insights**

```
Step 1: User Action
User clicks "Show Insights" button in React dashboard

Step 2: Frontend Processing
React App (ECS Fargate Container)
├─ Calls: APIClient.getInsights('pembrolizumab', 50)
├─ Method: GET
├─ URL: https://ndqszfo7nj.execute-api.us-west-2.amazonaws.com/prod/insights?molecule=pembrolizumab&limit=50
└─ Headers: { Authorization: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." }

Step 3: Network Layer
Cloudflare CDN (Global Edge)
├─ Receives: HTTPS request from user browser
├─ Security: DDoS protection, WAF rules
├─ Caching: Check edge cache (miss for API calls)
└─ Forwards to: ALB origin server

Step 4: Load Balancer
Application Load Balancer (ALB)
├─ Receives: HTTPS request on port 443
├─ Health Check: Verifies ECS targets are healthy
├─ Routing: Routes to healthy ECS task
└─ Forwards to: ECS Fargate container on port 8080

Step 5: Container Layer
ECS Fargate Task (React App + Nginx)
├─ Nginx receives: HTTP request on port 8080
├─ Serves: React static files (index.html, JS, CSS)
├─ React loads: Makes API call to backend
└─ API Call: HTTPS to API Gateway

Step 6: API Gateway
API Gateway (REST API)
├─ Receives: GET /insights?molecule=pembrolizumab&limit=50
├─ CORS: Validates origin domain
├─ Rate Limiting: Checks 2000 req/sec limit
├─ Authentication: Calls Cognito Authorizer
└─ Forwards to: Cognito User Pool

Step 7: Authentication
Cognito User Pool (us-west-2_qm5TpguBr)
├─ Validates: JWT token signature
├─ Checks: Token expiration (1 hour)
├─ Extracts: User claims (sub, email, groups)
├─ Returns: Authorized context to API Gateway
└─ Result: User authorized, proceed to Lambda

Step 8: Lambda Invocation
API Gateway → InsightsFunction Lambda
├─ Event: AWS Lambda Event with HTTP context
├─ Payload: { httpMethod: 'GET', path: '/insights', queryStringParameters: {...} }
├─ Context: User ID from Cognito claims
└─ Invokes: lambdas/api/insights_api.py

Step 9: Lambda Processing
InsightsFunction (ARM64, Python 3.12, 512MB)
├─ Parses: Query parameters (molecule, limit)
├─ Validates: User permissions
├─ Connects to: DynamoDB InsightsTable
└─ Queries: DynamoDB with molecule as PK

Step 10: Database Query
DynamoDB InsightsTable
├─ Receives: Query operation
├─ Key Condition: molecule = 'pembrolizumab'
├─ Limit: 50 items
├─ Sort: Latest first (ScanIndexForward=False)
├─ Returns: List of insight records
└─ Response Time: 10-50ms

Step 11: Lambda Response
InsightsFunction processes DynamoDB response
├─ Converts: Decimal to float (JSON serialization)
├─ Formats: Response structure
├─ Returns: { statusCode: 200, body: JSON string }
└─ Response Time: 10-30ms

Step 12: API Gateway Response
API Gateway receives Lambda response
├─ Adds: CORS headers
├─ Formats: HTTP response
├─ Status: 200 OK
└─ Returns: JSON to frontend

Step 13: Frontend Update
React App receives API response
├─ Parses: JSON response
├─ Updates: Component state
├─ Renders: Insights table with data
└─ Total Time: 150-400ms
```

---

### **Query Flow 2: AI Chat**

```
Step 1: User Action
User types "What's the latest on Keytruda?" in chat interface

Step 2: Frontend Processing
React Chat Component
├─ Calls: APIClient.chatWithAgent(message, sessionId)
├─ Method: POST
├─ URL: https://ndqszfo7nj.execute-api.us-west-2.amazonaws.com/prod/agent
├─ Body: { "message": "What's the latest on Keytruda?", "sessionId": "session_abc123" }
└─ Headers: { Authorization: "Bearer jwt-token", Content-Type: "application/json" }

Step 3-7: Same Network/Auth Flow as above
Cloudflare → ALB → ECS → API Gateway → Cognito → Authorized

Step 8: Lambda Invocation
API Gateway → AgentFunction Lambda
├─ Event: POST /agent with message body
├─ Function: lambdas/api/agent_api.py
├─ Memory: 1024MB (higher for AI processing)
└─ Timeout: 60 seconds

Step 9: Agent Lambda Processing
AgentFunction (ARM64, Python 3.12, 1024MB)
├─ Extracts: message and sessionId from request
├─ Validates: User context and permissions
├─ Prepares: Bedrock Agent invocation
└─ Calls: AWS Bedrock Agent Runtime

Step 10: Bedrock Agent
Bedrock Agent (HCGMGHWP6O, Alias: HI0539ELAS)
├─ Model: Claude 3.5 Sonnet v2
├─ Receives: User query + session context
├─ Analyzes: Query intent and required knowledge
├─ Decides: Need to search Knowledge Base
└─ Calls: Knowledge Base retrieval

Step 11: Knowledge Base Search
Bedrock Knowledge Base (QTXM82ECBV)
├─ Generates: Query embedding using Titan
├─ Searches: OpenSearch Serverless collection
├─ Vector Search: Finds top 10 similar documents
├─ Retrieves: Document content from S3
├─ Returns: Relevant documents with similarity scores
└─ Response Time: 200-500ms

Step 12: OpenSearch Vector Search
OpenSearch Serverless (2-4 OCUs)
├─ Receives: 1536-dimension vector query
├─ Searches: 50GB+ indexed documents
├─ Algorithm: Hybrid search (vector + keyword)
├─ Filters: By relevance score (>0.7)
├─ Returns: Top 10 matching documents
└─ Latency: p50: 50ms, p95: 200ms

Step 13: S3 Document Retrieval
S3 Knowledge Base Bucket
├─ Retrieves: Full document content
├─ Path: /kb/insights/2024/01/15/insight_12345.json
├─ Returns: Document metadata + content
└─ Latency: 10-30ms

Step 14: Agent Response Generation
Bedrock Agent (Claude 3.5 Sonnet)
├─ Context: Retrieved documents + user query
├─ Prompt: Augmented with relevant knowledge
├─ Generates: Response with source citations
├─ Processing: 2-5 seconds
└─ Returns: Structured response with sources

Step 15: Lambda Response
AgentFunction processes Bedrock response
├─ Formats: Response structure
├─ Adds: Source citations and metadata
├─ Returns: JSON response to API Gateway
└─ Total Lambda Time: 3-6 seconds

Step 16: Frontend Update
React Chat Component
├─ Receives: Agent response with sources
├─ Updates: Chat history state
├─ Renders: Message bubble with citations
├─ Displays: Source links for verification
└─ Total Time: 3-8 seconds
```

---

### **Query Flow 3: Add to Watchlist**

```
Step 1: User Action
User clicks "Add to Watchlist" for molecule "atezolizumab"

Step 2: Frontend Processing
React Watchlist Component
├─ Calls: APIClient.addToWatchlist(userId, 'atezolizumab')
├─ Method: POST
├─ URL: https://ndqszfo7nj.execute-api.us-west-2.amazonaws.com/prod/watchlist
└─ Body: { "userId": "user123", "molecule": "atezolizumab" }

Step 3-7: Same Network/Auth Flow
Cloudflare → ALB → ECS → API Gateway → Cognito → Authorized

Step 8: Lambda Invocation
API Gateway → WatchlistFunction Lambda
├─ Event: POST /watchlist
├─ Function: lambdas/api/watchlist_api.py
└─ Memory: 512MB

Step 9: Watchlist Lambda Processing
WatchlistFunction
├─ Extracts: userId and molecule from request body
├─ Validates: User permissions and molecule format
├─ Connects to: DynamoDB WatchlistTable
└─ Executes: PutItem operation

Step 10: DynamoDB Write
WatchlistTable
├─ Item: { PK: 'user123', SK: 'atezolizumab', created_at: '2024-01-15T10:30:00Z' }
├─ Operation: PutItem (creates or updates)
├─ Response: Success confirmation
└─ Latency: 5-20ms

Step 11: Lambda Response
WatchlistFunction
├─ Formats: Success response
├─ Returns: { statusCode: 200, body: '{"success": true}' }
└─ Total Time: 50-150ms

Step 12: Frontend Update
React Watchlist Component
├─ Receives: Success response
├─ Updates: Local state (adds molecule to list)
├─ Shows: Success notification
├─ Refreshes: Watchlist display
└─ Total Time: 100-300ms
```

---

### **Query Flow 4: Daily Data Processing (Background)**

```
Step 1: Scheduled Trigger
EventBridge Rule (Cron: 0 0 * * ? *)
├─ Time: Midnight UTC (11 PM IST)
├─ Triggers: 3 ingestion Lambda functions
└─ Staggered: 17:30, 17:35, 17:40 UTC (5-minute intervals)

Step 2: Data Ingestion
PubMedFunction Lambda (17:30 UTC)
├─ Connects to: PubMed API (https://eutils.ncbi.nlm.nih.gov/)
├─ Searches: Last 24 hours of publications
├─ Molecules: 16 pharmaceutical compounds
├─ Rate Limit: 3 requests/second
├─ Fetches: ~1000 articles
├─ Sends to: SQS Processing Queue
└─ Duration: 10-15 minutes

ClinicalTrialsFunction Lambda (17:35 UTC)
├─ Connects to: ClinicalTrials.gov API
├─ Searches: Last 7 days of trial updates
├─ Fetches: ~200 trial records
├─ Sends to: SQS Processing Queue
└─ Duration: 5-10 minutes

FDAFunction Lambda (17:40 UTC)
├─ Connects to: FDA openFDA API
├─ Searches: Last 7 days of regulatory updates
├─ Fetches: ~100 FDA records
├─ Sends to: SQS Processing Queue
└─ Duration: 3-5 minutes

Step 3: Message Queuing
SQS Processing Queue
├─ Receives: ~1300 messages total
├─ Batch Size: 10 messages per Lambda invocation
├─ Triggers: ProcessorFunction Lambda
└─ Processing: 130 Lambda invocations

Step 4: AI Processing
ProcessorFunction Lambda (ARM64, 1024MB)
├─ Receives: Batch of 10 documents from SQS
├─ Connects to: Bedrock Claude 3.5 Haiku
├─ Generates: AI analysis for each document
├─ Stores: Results in DynamoDB + S3
├─ Duration: 30-60 seconds per batch
└─ Total: 1-2 hours for all documents

Step 5: Bedrock AI Analysis
Claude 3.5 Haiku
├─ Receives: Document text + analysis prompt
├─ Analyzes: Sentiment, risks, opportunities
├─ Generates: Structured JSON response
├─ Returns: AI insights to Lambda
└─ Latency: 800ms - 2.5s per document

Step 6: Data Storage
ProcessorFunction stores results:
├─ DynamoDB InsightsTable: Structured insights
├─ S3 Data Bucket: Raw documents + processed insights
├─ S3 Knowledge Base: Formatted for RAG
└─ OpenSearch: Vector embeddings for search

Step 7: Knowledge Base Sync
Manual sync process:
├─ S3 documents → Bedrock Knowledge Base
├─ Titan Embeddings → Vector generation
├─ OpenSearch Indexing → Searchable vectors
└─ Ready for: Agent RAG queries
```

---

### **Query Flow 5: Daily Digest Email**

```
Step 1: Scheduled Trigger
EventBridge Rule (Cron: 0 9 * * ? *)
├─ Time: 9 AM UTC daily
└─ Triggers: DigestFunction Lambda

Step 2: Digest Generation
DigestFunction Lambda
├─ Queries: UserSettingsTable for users with digestEnabled=true
├─ For each user:
│  ├─ Queries: WatchlistTable for user's molecules
│  ├─ Queries: InsightsTable for last 24 hours
│  ├─ Calls: Bedrock Claude 3.5 Haiku for summary
│  └─ Sends: Email via SES
└─ Duration: 5-10 minutes for all users

Step 3: User Data Retrieval
DynamoDB Queries:
├─ UserSettingsTable: Get users with email notifications enabled
├─ WatchlistTable: Get each user's tracked molecules
├─ InsightsTable: Get insights from last 24 hours for user's molecules
└─ Response Time: 50-200ms per query

Step 4: AI Summary Generation
Bedrock Claude 3.5 Haiku
├─ Input: User's insights from last 24 hours
├─ Prompt: Generate personalized digest summary
├─ Output: HTML email with key insights, risks, opportunities
└─ Processing Time: 1-3 seconds per user

Step 5: Email Delivery
Amazon SES
├─ Receives: Email content from Lambda
├─ Validates: Sender domain and recipient
├─ Sends: HTML email to user
├─ Tracks: Delivery, bounces, complaints
└─ Delivery Time: 1-5 seconds

Step 6: User Receives Email
User Email Inbox
├─ Subject: "Your Daily Pharmaceutical Intelligence Digest"
├─ Content: Personalized insights for watchlist molecules
├─ Links: Back to dashboard for full details
└─ Time: 9:05-9:15 AM UTC (varies by email provider)
```

---

## Service Connection Map

### **Real-Time Query Path:**
```
User Browser
    ↓ HTTPS (443)
Cloudflare CDN (330+ PoPs)
    ↓ HTTPS (443)
ALB (us-west-2a/2b)
    ↓ HTTP (8080)
ECS Fargate (2-10 tasks)
    ↓ HTTPS (443)
API Gateway (REST API)
    ↓ JWT Validation
Cognito User Pool
    ↓ AWS Event
Lambda Function (ARM64)
    ↓ HTTPS (443)
DynamoDB/Bedrock/S3
    ↓ JSON Response
Lambda → API Gateway → ECS → ALB → Cloudflare → User
```

### **Background Processing Path:**
```
EventBridge Scheduler
    ↓ Cron Trigger
Ingestion Lambda Functions
    ↓ HTTPS API Calls
External APIs (PubMed, ClinicalTrials, FDA)
    ↓ JSON Data
SQS Processing Queue
    ↓ Batch Events (10 messages)
Processor Lambda Function
    ↓ HTTPS API Calls
Bedrock Claude 3.5 Haiku
    ↓ AI Analysis
DynamoDB + S3 + OpenSearch Storage
```

---

## Connection Protocols & Ports

| Connection | Protocol | Port | Authentication | Encryption |
|------------|----------|------|----------------|------------|
| User → Cloudflare | HTTPS | 443 | None | TLS 1.3 |
| Cloudflare → ALB | HTTPS | 443 | None | TLS 1.2 |
| ALB → ECS | HTTP | 8080 | None | None (internal) |
| ECS → API Gateway | HTTPS | 443 | None | TLS 1.2 |
| API Gateway → Cognito | HTTPS | 443 | AWS SigV4 | TLS 1.2 |
| API Gateway → Lambda | AWS Event | N/A | IAM Role | AWS Internal |
| Lambda → DynamoDB | HTTPS | 443 | IAM Role | TLS 1.2 |
| Lambda → Bedrock | HTTPS | 443 | IAM Role | TLS 1.2 |
| Lambda → S3 | HTTPS | 443 | IAM Role | TLS 1.2 |
| Lambda → SES | HTTPS | 443 | IAM Role | TLS 1.2 |
| EventBridge → Lambda | AWS Event | N/A | IAM Role | AWS Internal |
| SQS → Lambda | AWS Event | N/A | IAM Role | AWS Internal |

---

## Response Time Breakdown

### **GET /insights Query:**
```
Total Time: 150-400ms (p50: 200ms)

Breakdown:
├─ User → Cloudflare: 20-50ms (global CDN)
├─ Cloudflare → ALB: 10-30ms (origin latency)
├─ ALB → ECS: 5-15ms (load balancing)
├─ ECS → API Gateway: 20-50ms (API call)
├─ API Gateway → Cognito: 20-50ms (JWT validation)
├─ API Gateway → Lambda: 5-10ms (invocation)
├─ Lambda → DynamoDB: 10-50ms (query)
├─ Lambda Processing: 10-30ms (data formatting)
└─ Response Path: 50-125ms (reverse journey)
```

### **POST /agent Chat Query:**
```
Total Time: 3-8 seconds (p50: 4s)

Breakdown:
├─ Network Path: 100-200ms (same as above)
├─ Lambda → Bedrock Agent: 100-300ms (agent invocation)
├─ Knowledge Base Search: 200-500ms (vector search)
├─ OpenSearch Query: 50-200ms (similarity search)
├─ S3 Document Retrieval: 50-150ms (document fetch)
├─ Claude 3.5 Sonnet: 2-5 seconds (AI generation)
├─ Response Formatting: 50-100ms (citations)
└─ Response Path: 100-200ms (return journey)
```

---

## Error Handling Flow

### **Connection Failure Scenarios:**

```
If Cloudflare fails:
User → Direct ALB access (backup DNS)

If ALB fails:
Frontend down, but API Gateway still accessible directly

If ECS fails:
Frontend down, API endpoints still work

If API Gateway fails:
System unusable (no API access)

If Cognito fails:
Authentication fails, system unusable

If Lambda fails:
Specific function down, other functions work
Auto-retry: 2 attempts with exponential backoff

If DynamoDB fails:
Data access fails, cached responses only

If Bedrock fails:
AI features disabled, basic functionality works

If S3 fails:
Document storage fails, core features work

If OpenSearch fails:
Vector search disabled, basic search only
```

### **Retry Logic:**
```python
# Lambda Retry Logic
import time
import random

def retry_with_backoff(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            
            # Exponential backoff with jitter
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(wait_time)
```

---

## Connection Monitoring

### **Real-Time Metrics:**
```
CloudWatch Metrics per Connection:

Frontend → Backend:
├─ Request Count: API Gateway RequestCount
├─ Latency: API Gateway Latency (p50, p95, p99)
├─ Errors: API Gateway 4XXError, 5XXError
└─ Availability: API Gateway uptime

Backend → Lambda:
├─ Invocations: Lambda Invocations
├─ Duration: Lambda Duration
├─ Errors: Lambda Errors
├─ Throttles: Lambda Throttles
└─ Concurrent Executions: Lambda ConcurrentExecutions

Lambda → Services:
├─ DynamoDB: UserErrors, SystemErrors, ThrottledRequests
├─ Bedrock: ModelInvocations, ModelLatency, ModelErrors
├─ S3: NumberOfObjects, BucketSizeBytes
└─ SES: Send, Bounce, Complaint, Delivery
```

### **Alerting Thresholds:**
```
Critical Alerts:
├─ API Gateway 5xx > 10 in 5 minutes
├─ Lambda errors > 5 in 5 minutes
├─ DynamoDB throttling > 10 events
├─ Bedrock errors > 5 in 5 minutes
└─ ALB unhealthy targets > 0 for 2 minutes

Warning Alerts:
├─ API latency p95 > 2000ms
├─ Lambda duration p95 > 10 seconds
├─ ECS CPU > 80% for 10 minutes
└─ DynamoDB consumed capacity > 80%
```

---

## Summary: User Query → Response Journey

**Every user query follows this exact path through 13 services:**

1. **User Browser** (query input)
2. **Cloudflare CDN** (security + caching)
3. **Application Load Balancer** (load distribution)
4. **ECS Fargate Container** (React app hosting)
5. **API Gateway** (REST API endpoint)
6. **Cognito User Pool** (authentication)
7. **Lambda Function** (business logic)
8. **DynamoDB/Bedrock/S3** (data/AI services)
9. **Response travels back through same path**

**Total Services Touched:** 8-13 depending on query type
**Total Response Time:** 150ms (simple) to 8s (complex AI)
**Security Layers:** 4 (Cloudflare WAF, ALB, API Gateway, IAM)
**Monitoring Points:** 25+ CloudWatch metrics