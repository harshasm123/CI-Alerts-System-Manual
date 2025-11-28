# RAG Implementation Design Document

## Overview

This design implements Retrieval Augmented Generation (RAG) for the CI Alert System, enabling context-aware pharmaceutical competitive intelligence through semantic search and vector embeddings. The system will enhance the existing insight generation pipeline by retrieving relevant historical context before AI analysis, improving accuracy and providing trend-aware recommendations.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Data Ingestion Flow                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Processor Lambda (Enhanced with RAG)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Receive article from SQS                              │  │
│  │ 2. Generate query embedding (Titan Embeddings)           │  │
│  │ 3. Search vector DB for similar insights (OpenSearch)    │  │
│  │ 4. Retrieve top 5 relevant historical insights           │  │
│  │ 5. Construct enriched prompt with context                │  │
│  │ 6. Call Nova Lite with context                           │  │
│  │ 7. Store insight in DynamoDB                             │  │
│  │ 8. Generate embedding for new insight                    │  │
│  │ 9. Store vector in OpenSearch                            │  │
│  │ 10. Write document to S3 Knowledge Base                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Storage Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  DynamoDB    │  │  OpenSearch  │  │  S3 Bucket   │         │
│  │  (Insights)  │  │  (Vectors)   │  │  (Docs)      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Bedrock Knowledge Base (Automatic Sync)            │
│  - Monitors S3 bucket for new documents                         │
│  - Generates embeddings with Titan                              │
│  - Indexes in OpenSearch                                        │
│  - Available for Agent queries                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Bedrock Agent (Enhanced)                     │
│  - Queries Knowledge Base for context                           │
│  - Uses Nova Premier for analysis                               │
│  - Provides source attribution                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction

```
User Query → API Gateway → Bedrock Agent
                              ↓
                    Knowledge Base Query
                              ↓
                    OpenSearch Vector Search
                              ↓
                    Retrieve Top K Documents
                              ↓
                    Nova Premier + Context
                              ↓
                    Response with Citations
```

## Components and Interfaces

### 1. Enhanced Processor Lambda

**Purpose**: Analyze pharmaceutical news with RAG-enhanced AI

**Inputs**:
- SQS message containing article data (molecule, content, source)

**Outputs**:
- Insight stored in DynamoDB with sources field
- Vector embedding stored in OpenSearch
- Document written to S3 Knowledge Base bucket

**Key Functions**:
```python
def generate_embedding(text: str) -> List[float]
def search_similar_insights(embedding: List[float], limit: int = 5) -> List[Dict]
def construct_rag_prompt(article: str, context: List[Dict]) -> str
def store_vector(insight_id: str, embedding: List[float], metadata: Dict) -> None
def write_to_knowledge_base(insight: Dict) -> None
```

### 2. OpenSearch Serverless Collection

**Purpose**: Store and query vector embeddings

**Configuration**:
- Collection Type: VECTORSEARCH
- Index Name: ci-alert-insights-index
- Vector Dimensions: 1536 (Titan Embeddings v1)
- Similarity Metric: Cosine similarity

**Index Schema**:
```json
{
  "mappings": {
    "properties": {
      "embedding": {
        "type": "knn_vector",
        "dimension": 1536,
        "method": {
          "name": "hnsw",
          "engine": "faiss"
        }
      },
      "insight_id": { "type": "keyword" },
      "molecule": { "type": "keyword" },
      "timestamp": { "type": "date" },
      "source": { "type": "keyword" },
      "sentiment": { "type": "keyword" },
      "text": { "type": "text" }
    }
  }
}
```

### 3. Bedrock Knowledge Base

**Purpose**: Orchestrate RAG workflow and manage document ingestion

**Configuration**:
- Name: ci-alert-knowledge-base
- Embedding Model: amazon.titan-embed-text-v1
- Vector Store: OpenSearch Serverless
- Data Source: S3 bucket (ci-alert-kb-documents)

**Data Source Configuration**:
```typescript
{
  type: 'S3',
  bucketArn: 'arn:aws:s3:::ci-alert-kb-documents',
  inclusionPrefixes: ['insights/'],
  chunkingStrategy: {
    chunkingStrategy: 'NONE' // Documents are pre-formatted
  }
}
```

### 4. S3 Knowledge Base Bucket

**Purpose**: Store formatted documents for Knowledge Base ingestion

**Structure**:
```
ci-alert-kb-documents/
└── insights/
    └── YYYY/
        └── MM/
            └── DD/
                └── {molecule}_{timestamp}.json
```

**Document Format**:
```json
{
  "insight_id": "uuid",
  "molecule": "Keytruda",
  "timestamp": "2024-11-28T12:00:00Z",
  "source": "PubMed",
  "sentiment": "POSITIVE",
  "text": "Full insight text for embedding...",
  "metadata": {
    "impact": "HIGH",
    "category": "clinical_trial"
  }
}
```

### 5. Bedrock Agent with Knowledge Base

**Purpose**: Answer user queries with RAG-enhanced responses

**Configuration**:
```typescript
{
  agentName: 'ci-alert-agent',
  foundationModel: 'us.amazon.nova-premier-v1:0',
  knowledgeBases: [{
    knowledgeBaseId: 'auto-generated',
    description: 'Historical pharmaceutical insights',
    knowledgeBaseState: 'ENABLED'
  }],
  instruction: 'You are a pharmaceutical analyst. Use the knowledge base to provide context-aware insights...'
}
```

## Data Models

### Insight (DynamoDB) - Enhanced

```typescript
interface Insight {
  molecule: string;              // Partition key
  timestamp: string;             // Sort key (ISO 8601)
  insight_id: string;            // UUID
  insights: string;              // AI-generated analysis
  source: string;                // PubMed, FDA, etc.
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  raw_content: string;           // First 1000 chars
  
  // NEW RAG fields
  sources?: Array<{              // Historical insights used
    insight_id: string;
    molecule: string;
    timestamp: string;
    similarity_score: number;
  }>;
  embedding_id?: string;         // Reference to vector in OpenSearch
  kb_document_path?: string;     // S3 path for KB document
}
```

### Vector Document (OpenSearch)

```typescript
interface VectorDocument {
  insight_id: string;            // Primary identifier
  embedding: number[];           // 1536-dimensional vector
  molecule: string;              // For filtering
  timestamp: string;             // ISO 8601
  source: string;                // Data source
  sentiment: string;             // Sentiment classification
  text: string;                  // Full insight text
  metadata: {
    impact?: string;
    category?: string;
  };
}
```

### Knowledge Base Document (S3)

```json
{
  "insight_id": "string",
  "molecule": "string",
  "timestamp": "ISO 8601",
  "source": "string",
  "sentiment": "string",
  "text": "string",
  "metadata": {
    "impact": "string",
    "category": "string"
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Embedding generation consistency
*For any* insight text, generating an embedding twice should produce vectors with cosine similarity > 0.99
**Validates: Requirements 2.2**

### Property 2: Vector storage completeness
*For any* insight stored in DynamoDB, if embedding generation succeeds, then a corresponding vector document SHALL exist in OpenSearch with the same insight_id
**Validates: Requirements 2.4**

### Property 3: Retrieval relevance ordering
*For any* vector search query, the returned results SHALL be ordered by similarity score in descending order
**Validates: Requirements 3.3**

### Property 4: Historical context inclusion
*For any* new insight generation with available historical context, the stored insight SHALL include a non-empty sources array
**Validates: Requirements 1.2, 1.4**

### Property 5: Fallback behavior preservation
*For any* RAG operation failure, the system SHALL still store the insight in DynamoDB without the RAG-specific fields
**Validates: Requirements 9.1, 9.4**

### Property 6: S3 document format validity
*For any* document written to the S3 knowledge base bucket, the JSON SHALL be valid and conform to the document schema
**Validates: Requirements 6.2**

### Property 7: Similarity score threshold
*For any* semantic search result, if the similarity score is below 0.7, then the result SHALL NOT be included in the response
**Validates: Requirements 7.4**

### Property 8: Knowledge base sync idempotency
*For any* insight, writing it to S3 multiple times SHALL result in the same vector being indexed in the knowledge base
**Validates: Requirements 6.4**

### Property 9: Source attribution completeness
*For any* insight generated with RAG, each source in the sources array SHALL include insight_id, molecule, timestamp, and similarity_score fields
**Validates: Requirements 10.2**

### Property 10: Embedding dimension consistency
*For any* embedding generated by Titan Embeddings v1, the vector dimension SHALL equal 1536
**Validates: Requirements 2.2**

## Error Handling

### Embedding Generation Failures

**Scenario**: Titan Embeddings API returns error or times out

**Handling**:
1. Log error with insight_id and error details
2. Emit CloudWatch metric: `EmbeddingGenerationFailure`
3. Continue storing insight in DynamoDB without embedding_id
4. Skip vector storage in OpenSearch
5. Skip S3 knowledge base document creation

**Retry Strategy**: 3 retries with exponential backoff (1s, 2s, 4s)

### OpenSearch Unavailability

**Scenario**: OpenSearch Serverless collection is unavailable or returns errors

**Handling**:
1. Log error with operation type (search/store)
2. Emit CloudWatch metric: `OpenSearchFailure`
3. For search operations: Return empty context array, proceed with insight generation
4. For store operations: Log failure, continue without blocking
5. Set circuit breaker after 5 consecutive failures (5-minute cooldown)

**Fallback**: Use DynamoDB-only queries for search operations

### Knowledge Base Sync Failures

**Scenario**: S3 write fails or Knowledge Base ingestion errors

**Handling**:
1. Retry S3 write up to 3 times with exponential backoff
2. Log error with S3 path and error details
3. Emit CloudWatch metric: `KnowledgeBaseSyncFailure`
4. Continue without blocking insight storage
5. Create DLQ message for manual retry if all attempts fail

**Recovery**: Batch sync job runs daily to catch missed documents

### Bedrock Agent Knowledge Base Query Failures

**Scenario**: Knowledge Base query times out or returns errors

**Handling**:
1. Log error with query details
2. Emit CloudWatch metric: `KnowledgeBaseQueryFailure`
3. Agent continues with response using only foundation model knowledge
4. Include disclaimer in response: "Unable to retrieve historical context"

**Timeout**: 5-second timeout for knowledge base queries

### Performance Degradation

**Scenario**: Vector search latency exceeds 500ms threshold

**Handling**:
1. Emit CloudWatch metric: `VectorSearchLatency`
2. Create CloudWatch alarm if p95 latency > 500ms for 5 minutes
3. Reduce retrieval limit from 5 to 3 documents
4. Enable query result caching for common molecules

**Monitoring**: Track p50, p95, p99 latencies

## Testing Strategy

### Unit Tests

**Embedding Generation**:
- Test Titan Embeddings API integration
- Verify embedding dimension is 1536
- Test error handling for API failures
- Verify retry logic with exponential backoff

**Vector Storage**:
- Test OpenSearch document creation
- Verify index schema compliance
- Test metadata field population
- Verify error handling for storage failures

**Semantic Search**:
- Test query embedding generation
- Verify similarity score calculation
- Test result ranking by similarity
- Verify threshold filtering (score < 0.7)

**S3 Document Writing**:
- Test JSON formatting
- Verify S3 path structure (YYYY/MM/DD)
- Test error handling for write failures
- Verify document schema compliance

### Property-Based Tests

**Property 1: Embedding consistency**
- Generate random insight texts
- Create embeddings twice for each
- Verify cosine similarity > 0.99

**Property 2: Vector storage completeness**
- Generate random insights
- Store in DynamoDB with successful embedding
- Verify corresponding vector exists in OpenSearch

**Property 3: Retrieval ordering**
- Generate random query embeddings
- Perform vector search
- Verify results are sorted by similarity descending

**Property 4: Context inclusion**
- Generate random insights with available context
- Verify sources array is non-empty
- Verify sources contain required fields

**Property 5: Fallback preservation**
- Simulate RAG failures
- Verify insights still stored in DynamoDB
- Verify no RAG fields present

**Property 6: Document format validity**
- Generate random insights
- Write to S3
- Parse JSON and validate against schema

**Property 7: Similarity threshold**
- Generate random search results with varying scores
- Filter by threshold 0.7
- Verify no results with score < 0.7

**Property 8: Sync idempotency**
- Write same insight to S3 multiple times
- Verify single vector in knowledge base
- Verify vector content is identical

**Property 9: Source attribution**
- Generate insights with RAG
- Verify each source has all required fields
- Verify field types are correct

**Property 10: Dimension consistency**
- Generate random texts
- Create embeddings
- Verify all vectors have dimension 1536

### Integration Tests

**End-to-End RAG Flow**:
1. Ingest test article
2. Verify embedding generation
3. Verify vector storage in OpenSearch
4. Verify S3 document creation
5. Query for similar insights
6. Verify retrieval and ranking
7. Generate new insight with context
8. Verify sources field populated

**Bedrock Agent with Knowledge Base**:
1. Populate knowledge base with test insights
2. Query agent about a molecule
3. Verify knowledge base is queried
4. Verify response includes citations
5. Verify citations reference actual insights

**Failure Recovery**:
1. Simulate OpenSearch failure
2. Verify fallback to DynamoDB
3. Verify insight still generated
4. Restore OpenSearch
5. Verify system recovers automatically

### Performance Tests

**Vector Search Latency**:
- Load 100,000 vectors into OpenSearch
- Perform 1000 concurrent searches
- Verify p95 latency < 500ms

**Embedding Generation Throughput**:
- Generate embeddings for 100 insights concurrently
- Verify all complete within 30 seconds
- Verify no rate limiting errors

**Knowledge Base Sync**:
- Write 1000 documents to S3
- Verify all indexed within 10 minutes
- Verify all searchable via knowledge base

## Deployment Considerations

### Infrastructure as Code

All resources deployed via AWS CDK:
- OpenSearch Serverless collection
- Bedrock Knowledge Base
- S3 bucket with lifecycle policies
- IAM roles and policies
- Lambda function updates

### Cost Estimates

**Monthly Costs (Light Usage - 1000 insights/day)**:
- OpenSearch Serverless: $700/month (4 OCUs)
- Titan Embeddings: $0.10/1M tokens × 2M tokens = $0.20
- S3 Storage: 10GB × $0.023 = $0.23
- Knowledge Base: No additional charge
- **Total Additional Cost: ~$700/month**

**Cost Optimization**:
- Use on-demand OCUs (scale to zero when idle)
- Implement embedding caching for common queries
- Batch embedding generation
- Set S3 lifecycle policy (archive after 90 days)

### Rollout Strategy

**Phase 1: Infrastructure Setup**
- Deploy OpenSearch collection
- Deploy Knowledge Base
- Deploy S3 bucket
- Verify connectivity

**Phase 2: Processor Lambda Enhancement**
- Deploy updated Lambda with RAG code
- Enable feature flag (disabled by default)
- Test with 10% of traffic
- Monitor error rates and latency

**Phase 3: Backfill Historical Data**
- Run batch job to embed existing insights
- Populate OpenSearch with historical vectors
- Sync to S3 knowledge base
- Verify search functionality

**Phase 4: Bedrock Agent Integration**
- Attach knowledge base to agent
- Test agent queries
- Enable for beta users
- Monitor usage and feedback

**Phase 5: Full Rollout**
- Enable RAG for 100% of traffic
- Monitor performance metrics
- Optimize based on usage patterns

### Monitoring and Alerts

**CloudWatch Metrics**:
- `EmbeddingGenerationSuccess/Failure`
- `VectorSearchLatency` (p50, p95, p99)
- `OpenSearchAvailability`
- `KnowledgeBaseSyncSuccess/Failure`
- `RAGContextRetrievalCount`

**CloudWatch Alarms**:
- Embedding failure rate > 5%
- Vector search p95 latency > 500ms
- OpenSearch unavailable for > 5 minutes
- Knowledge base sync failures > 10/hour

**Dashboard Widgets**:
- RAG usage rate (% of insights using context)
- Average similarity scores
- Context retrieval distribution
- Error rates by operation type
