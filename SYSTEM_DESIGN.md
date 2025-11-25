# System Design Document: Competitive Intelligence Alert System

## 1. Executive Summary

The Competitive Intelligence Alert System is a production-grade AWS solution that automatically ingests global drug/molecule-related news and delivers personalized daily digest emails at 9 AM based on user-defined molecule watchlists.

## 2. System Architecture

### 2.1 High-Level Architecture

```
Internet → CloudFront/WAF → ALB → ECS/Fargate (React UI)
                                     ↓
External APIs → Lambda Ingestors → SQS → Processor Lambda
                                           ↓
EventBridge Scheduler → Daily Digest Lambda → SES
                                           ↓
                              Bedrock (Claude + Titan) ← S3 Knowledge Base
                                           ↓
                                      DynamoDB Tables
                                           ↑
API Gateway ← Cognito ← React UI ←────────┘
```

### 2.2 Core Components

#### Data Ingestion Layer
- **Ingestion Lambdas**: Fetch from PubMed, ClinicalTrials.gov, FDA, EMA, WIPO
- **SQS Queue**: Decouples ingestion from processing (dead letter queue included)
- **EventBridge Rules**: Schedule periodic ingestion (hourly for real-time sources)

#### AI Processing Layer
- **Bedrock Agent**: Orchestrates AI workflows with knowledge base
- **Claude 3 Sonnet**: Text summarization and impact analysis
- **Titan Embeddings**: Semantic similarity and relevance scoring
- **Knowledge Base**: S3-backed vector store with historical insights

#### Storage Layer
- **DynamoDB Tables**:
  - InsightsTable: PK=insight_id, SK=timestamp, GSI1=molecule→timestamp
  - UserSettingsTable: PK=user_id, contains email preferences
  - WatchlistTable: PK=user_id, SK=molecule
- **S3 Buckets**: Raw data, processed data, knowledge base vectors

#### User Interface Layer
- **React Application**: Molecule watchlist management, insight viewing
- **ECS/Fargate**: Containerized deployment with auto-scaling
- **Application Load Balancer**: HTTPS termination and routing
- **CloudFront**: Global CDN with WAF protection

#### Notification Layer
- **Daily Digest Lambda**: Triggered at 9 AM, queries user watchlists
- **SES**: Email delivery with templates and bounce handling
- **Real-time Alerts**: High-impact event notifications

## 3. Data Model

### 3.1 DynamoDB Schema

#### InsightsTable
```json
{
  "insight_id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "molecule": "pembrolizumab",
  "title": "FDA Approves Pembrolizumab for New Indication",
  "summary": "AI-generated summary",
  "source": "FDA",
  "url": "https://...",
  "relevance_score": 0.95,
  "impact_level": "HIGH",
  "entities": ["Merck", "oncology", "FDA approval"],
  "raw_text": "Original article text"
}
```

#### UserSettingsTable
```json
{
  "user_id": "cognito-uuid",
  "email": "user@company.com",
  "alert_time": "09:00",
  "timezone": "America/New_York",
  "preferences": {
    "min_relevance": 0.7,
    "sources": ["FDA", "EMA", "PubMed"]
  }
}
```

#### WatchlistTable
```json
{
  "user_id": "cognito-uuid",
  "molecule": "pembrolizumab",
  "created_at": "2024-01-15T10:30:00Z",
  "aliases": ["keytruda", "MK-3475"]
}
```

### 3.2 S3 Structure
```
ci-alert-data-bucket/
├── raw/
│   ├── pubmed/YYYY/MM/DD/
│   ├── fda/YYYY/MM/DD/
│   └── ema/YYYY/MM/DD/
├── processed/
│   └── insights/YYYY/MM/DD/
└── knowledge-base/
    ├── vectors/
    └── metadata/
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

1. **Text Normalization**: Clean HTML, extract text, standardize format
2. **Entity Extraction**: Identify molecules, companies, indications using NER
3. **Relevance Scoring**: Titan Embeddings similarity to user watchlist
4. **Impact Analysis**: Claude 3 Sonnet classification (LOW/MEDIUM/HIGH)
5. **Summarization**: Generate concise summaries for email digest

### 5.2 Bedrock Agent Configuration

```json
{
  "agentName": "CI-Alert-Agent",
  "instruction": "You are a competitive intelligence analyst specializing in pharmaceutical and biotech news. Analyze drug development news and provide relevance scores and impact summaries.",
  "foundationModel": "anthropic.claude-3-sonnet-20240229-v1:0",
  "knowledgeBases": [
    {
      "knowledgeBaseId": "auto-generated",
      "description": "Historical pharmaceutical insights and molecule data"
    }
  ]
}
```

## 6. Security Architecture

### 6.1 Network Security
- **VPC**: Private subnets for all compute resources
- **VPC Endpoints**: S3, DynamoDB, Bedrock, SQS (no NAT Gateway)
- **Security Groups**: Least privilege access rules
- **WAF**: CloudFront protection against common attacks

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
- **ECS Service**: Target tracking on CPU/memory utilization
- **Lambda**: Concurrent execution limits and reserved capacity
- **DynamoDB**: On-demand billing with burst capacity

### 7.2 Performance Optimizations
- **CloudFront**: Global edge caching for static assets
- **DynamoDB GSI**: Optimized query patterns for molecule lookups
- **Lambda ARM64**: Better price/performance ratio
- **SQS Batching**: Reduce Lambda invocations

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

### 9.2 Estimated Monthly Costs (1000 users)
- **Compute**: $200 (Lambda + ECS)
- **Storage**: $50 (DynamoDB + S3)
- **AI/ML**: $300 (Bedrock usage)
- **Networking**: $100 (CloudFront + VPC Endpoints)
- **Total**: ~$650/month

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