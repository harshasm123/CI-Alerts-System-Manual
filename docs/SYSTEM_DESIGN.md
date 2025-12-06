# System Design Document: Competitive Intelligence Alert System

## 1. Executive Summary

Production-grade GenAI system for pharmaceutical competitive intelligence using AWS Bedrock, RAG knowledge base with OpenSearch Serverless, serverless architecture, and AI-powered daily email digests.

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────────┐
│  User   │───▶│ Route 53 │───▶│ ALB (HTTPS) │───▶│ ECS Fargate      │
└─────────┘    └──────────┘    └─────────────┘    │ (React + Nginx)  │
                                       │           └──────────────────┘
                                       ▼
                               ┌───────────────┐
                               │ Cognito Auth  │
                               │ (JWT Tokens)  │
                               └───────────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │   API Gateway       │
                            │ (Cognito Authorizer)│
                            └─────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  │                  ▼
            ┌───────────────┐          │          ┌──────────────┐
            │ Lambda        │          │          │ Bedrock      │
            │ Functions     │◀─────────┼─────────▶│ Agent (RAG)  │
            └───────────────┘          │          └──────────────┘
                    │                  │                  │
                    ▼                  │                  ▼
            ┌───────────────┐          │          ┌──────────────┐
            │ DynamoDB      │          │          │ Knowledge    │
            │ Tables        │          │          │ Base (S3)    │
            └───────────────┘          │          └──────────────┘
                                       │                  │
                                       │                  ▼
                                       │          ┌──────────────┐
                                       │          │ OpenSearch   │
                                       │          │ Serverless   │
                                       │          └──────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Event-Driven Processing                      │
├─────────────────────────────────────────────────────────────────────┤
│ EventBridge (Midnight) → PubMed Ingestion → SQS → Processor        │
│                                                      │               │
│                                                      ▼               │
│                                              Claude 3.5 Haiku      │
│                                                                     │
│ EventBridge (9 AM) → Digest Lambda → AI Summary → SES Email        │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### Infrastructure (6 Stacks)
1. **CIAlertStack** - Core (DynamoDB, Lambda, API Gateway, Cognito, SQS, EventBridge)
2. **CIAlert-KnowledgeBase** - S3 + OpenSearch Serverless + Bedrock KB
3. **CIAlert-BedrockAgent** - Bedrock Agent + RAG actions
4. **CIAlert-Frontend** - ALB + ECS Fargate + VPC for React app
5. **CIAlert-Monitoring** - CloudWatch dashboards and alarms
6. **CIAlert-CICD** - CodePipeline for automated deployments

#### Data Ingestion Layer
- **PubMedFunction**: Fetches pharmaceutical news from PubMed API
- **SQS Queue**: Decouples ingestion from processing (batch size 10)
- **EventBridge Rules**: Midnight UTC ingestion, 9 AM UTC digest

#### AI Processing Layer (2-Model Architecture)
- **Claude 3.5 Haiku**: Cost-effective batch processing ($0.25/$1.25 per 1M tokens)
- **Claude 3.5 Sonnet v2**: Interactive agent queries ($3/$15 per 1M tokens)
- **Bedrock Agent**: RAG-enabled chat with document citations
- **Titan Embeddings**: Vector generation for knowledge base
- **OpenSearch Serverless**: Vector storage with hybrid search

#### Storage Layer
- **DynamoDB Tables** (On-Demand):
  - InsightsTable: PK=molecule, SK=timestamp, GSI1=molecule→timestamp
  - UserSettingsTable: PK=userId, email preferences
  - WatchlistTable: PK=userId, SK=molecule
- **S3 Buckets**: Knowledge base documents, processed insights

#### User Interface Layer
- **React Application**: AWS Amplify v6 authentication, modern UI with tabs
- **ECS Fargate**: Containerized React app with nginx reverse proxy
- **Application Load Balancer**: HTTPS termination, health checks, auto-scaling
- **VPC**: Private subnets with NAT Gateway for secure networking
- **Route 53**: DNS management with health checks and failover
- **Chat Interface**: Interactive Bedrock Agent with RAG search

#### Notification Layer
- **DigestFunction**: AI-powered email summaries with Claude analysis
- **SES**: Email delivery with HTML templates
- **Executive Summaries**: Claude generates strategic overviews

## 3. Data Model

### 3.1 DynamoDB Schema

#### InsightsTable
```json
{
  "molecule": "Keytruda",
  "timestamp": "2024-01-15T10:30:00Z",
  "insights": "AI-generated JSON analysis",
  "source": "PubMed",
  "raw_content": "Original article text (first 1000 chars)",
  "impact_score": 0.95,
  "sentiment": "Negative",
  "ttl": 1736956200
}
```

#### UserSettingsTable
```json
{
  "userId": "test@example.com",
  "email": "user@company.com",
  "digestEnabled": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

#### WatchlistTable
```json
{
  "userId": "test@example.com",
  "molecule": "Keytruda",
  "added_at": "2024-01-15T10:30:00Z",
  "alert_enabled": true,
  "min_impact_score": 0.7
}
```

### 3.2 S3 Structure
```
ci-alert-kb-{account}-{region}/
└── documents/
    ├── regulatory/
    │   ├── fda/
    │   └── ema/
    ├── clinical-trials/
    ├── patents/
    ├── market-research/
    └── literature/
```

## 4. API Integrations

### 4.1 External Data Sources

#### PubMed API
- **Endpoint**: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`
- **Rate Limit**: 3 requests/second
- **Authentication**: None (free)
- **Query**: Search by molecule name + clinical terms

#### ClinicalTrials.gov API
- **Endpoint**: `https://clinicaltrials.gov/api/`
- **Rate Limit**: No official limit
- **Authentication**: None (free)
- **Query**: Search by intervention/condition

#### FDA Drugs@FDA
- **Endpoint**: RSS feeds and JSON APIs
- **Rate Limit**: Reasonable use
- **Authentication**: None (free)
- **Query**: Drug approval announcements

#### EMA RSS Feeds
- **Endpoint**: `https://www.ema.europa.eu/en/rss.xml`
- **Rate Limit**: Standard RSS polling
- **Authentication**: None (free)
- **Query**: Medicine approvals and safety updates

#### WIPO PatentScope
- **Endpoint**: `https://patentscope.wipo.int/search/en/rss/`
- **Rate Limit**: Standard RSS polling
- **Authentication**: None (free)
- **Query**: Patent publications by molecule

## 5. AI/ML Pipeline

### 5.1 Processing Workflow

1. **Data Ingestion**: PubMed API → SQS Queue (batch size 10)
2. **AI Processing**: Claude 3.5 Haiku analyzes content with structured prompt
3. **Storage**: DynamoDB with GSI1 for molecule-based queries
4. **Knowledge Base Sync**: Documents uploaded to S3 trigger ingestion jobs
5. **Vector Search**: Titan Embeddings + OpenSearch Serverless hybrid search
6. **Daily Digest**: Claude generates executive summaries at 9 AM UTC

### 5.2 RAG Knowledge Base Configuration

```yaml
KnowledgeBase:
  name: ci-alert-knowledge-base
  embeddingModel: amazon.titan-embed-text-v1
  storage: OpenSearch Serverless
  chunkingStrategy: FIXED_SIZE (512 tokens, 20% overlap)
  dataSource: S3 (documents/ prefix)

BedrockAgent:
  name: ci-alert-agent
  model: anthropic.claude-3-5-sonnet-20241022-v2:0
  knowledgeBase: ci-alert-knowledge-base
  actionGroups:
    - query_insights: Get DynamoDB insights
    - analyze_trends: Sentiment analysis
    - compare_molecules: Compare two molecules
    - search_knowledge: RAG search
```

## 6. Security Architecture

### 6.1 Network Security
- **VPC Architecture**: Private subnets for ECS, public subnets for ALB
- **Application Load Balancer**: HTTPS-only with WAF v2 protection
- **Security Groups**: Restrictive inbound rules (ALB → ECS port 80 only)
- **NAT Gateway**: Secure outbound internet access for ECS tasks
- **API Gateway**: Cognito JWT authorizer on all endpoints
- **S3**: Block public access, encryption at rest

### 6.2 Identity & Access Management
- **Cognito User Pool**: Email-based authentication with optional MFA
- **IAM Roles**: Least privilege for all services
- **Resource-based Policies**: Fine-grained DynamoDB and S3 access

### 6.3 Data Protection
- **Encryption at Rest**: S3 (SSE-S3), DynamoDB (AWS managed)
- **Encryption in Transit**: HTTPS/TLS everywhere
- **Secrets Management**: AWS Secrets Manager for API keys

## 7. Scalability & Performance

### 7.1 Auto-scaling Configuration
- **Lambda**: 100 concurrent executions per function
- **DynamoDB**: On-demand capacity mode
- **OpenSearch Serverless**: Auto-scaling OCUs (2 minimum)
- **ECS Fargate**: Auto-scaling 2-10 tasks based on CPU/memory
- **ALB**: Multi-AZ deployment with health checks

### 7.2 Performance Optimizations
- **GSI1 Index**: Fast molecule-based queries (molecule → timestamp)
- **SQS Batching**: Process 10 messages per Lambda invocation
- **ALB Sticky Sessions**: Session affinity for React app
- **ECS Task Placement**: Spread across AZs for high availability
- **Nginx Caching**: Static asset caching within containers
- **Hybrid Search**: Vector + keyword search in OpenSearch
- **2-Model Strategy**: Haiku for batch, Sonnet for interactive

## 8. Monitoring & Observability

### 8.1 CloudWatch Metrics
- **Custom Metrics**: Ingestion rate, processing latency, email delivery
- **Alarms**: Failed ingestions, high error rates, cost thresholds
- **Dashboard**: Real-time system health visualization

### 8.2 Logging Strategy
- **Structured Logging**: JSON format with correlation IDs
- **Log Retention**: 30 days for operational logs, 1 year for audit logs
- **X-Ray Tracing**: End-to-end request tracing

## 9. Cost Optimization

### 9.1 Infrastructure Costs
- **VPC Endpoints**: $45/month vs NAT Gateway $135/month
- **Spot Instances**: 70% savings for non-critical workloads
- **S3 Intelligent Tiering**: Automatic cost optimization
- **DynamoDB On-Demand**: Pay per request vs provisioned capacity

### 9.2 Estimated Monthly Costs (100 users, 100 insights/day)
- **Lambda**: $2 (1M requests)
- **DynamoDB**: $5 (On-Demand)
- **S3**: $5 (50GB + documents)
- **ECS Fargate**: $45 (2 tasks, 0.5 vCPU, 1GB RAM)
- **ALB**: $22 (1 ALB + LCU charges)
- **NAT Gateway**: $45 (1 NAT + data processing)
- **Route 53**: $1 (hosted zone + health checks)
- **Cognito**: Free (50K MAU)
- **SES**: $1 (10K emails)
- **CloudWatch**: $3
- **Bedrock Models**:
  - Claude 3.5 Haiku (batch): $0.50
  - Claude 3.5 Sonnet v2 (agent): $44
  - Titan Embeddings: $15
- **OpenSearch Serverless**: $55 (2 OCUs)
- **Total**: ~$245/month

**Cost Optimization**:
- 2-model approach saves $13.50/month vs single Sonnet
- OpenSearch Serverless vs Service saves $35/month
- ECS Fargate vs EC2 saves on management overhead
- Single NAT Gateway vs multi-AZ saves $45/month

## 10. Disaster Recovery

### 10.1 Backup Strategy
- **DynamoDB**: Point-in-time recovery enabled
- **S3**: Cross-region replication for critical data
- **Code**: Multi-region CodeCommit repositories

### 10.2 Recovery Procedures
- **RTO**: 4 hours for full system recovery
- **RPO**: 1 hour for data loss tolerance
- **Runbooks**: Automated recovery procedures in CloudFormation

## 11. Compliance & Governance

### 11.1 Data Governance
- **Data Classification**: Public (news), Internal (user preferences)
- **Retention Policies**: 7 years for insights, 3 years for logs
- **Privacy**: GDPR-compliant user data handling

### 11.2 Operational Governance
- **Change Management**: GitOps with CodePipeline
- **Access Control**: Role-based access with regular reviews
- **Audit Logging**: CloudTrail for all API calls