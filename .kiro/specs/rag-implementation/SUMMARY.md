# RAG Implementation Spec - Summary

## Overview

This spec defines the implementation of **Retrieval Augmented Generation (RAG)** with a vector database for the CI Alert System, transforming it from a simple AI analysis pipeline into a context-aware pharmaceutical competitive intelligence platform.

## What Changes

### Before (Current State)
```
Article → Processor Lambda → Nova Lite (direct) → DynamoDB
```

### After (With RAG)
```
Article → Processor Lambda → 
  1. Search vector DB for similar insights
  2. Retrieve top 5 historical contexts
  3. Nova Lite with enriched context → 
  4. Store in DynamoDB + OpenSearch + S3
```

## Key Features

### 1. Context-Aware AI Analysis
- AI considers historical insights when analyzing new articles
- Provides trend-aware recommendations
- References past events in analysis

### 2. Semantic Search
- Search by meaning, not just keywords
- Find related insights across different molecules
- Similarity-based ranking

### 3. Knowledge Base
- Automatic document ingestion from S3
- Vector embeddings with Titan
- Bedrock Agent integration

### 4. Source Attribution
- Every insight shows which historical insights influenced it
- Transparency and traceability
- Clickable source references in UI

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Vector Database** | OpenSearch Serverless | Store and query embeddings |
| **Embeddings** | Amazon Titan Embeddings v1 | Convert text to 1536-dim vectors |
| **Knowledge Base** | Bedrock Knowledge Base | Orchestrate RAG workflow |
| **Document Storage** | S3 | Store formatted documents |
| **AI Model** | Amazon Nova Lite | Generate insights with context |
| **Agent Model** | Amazon Nova Premier | Answer queries with KB |

## Architecture Components

### 1. Enhanced Processor Lambda
- Generates embeddings for incoming articles
- Searches OpenSearch for similar insights
- Constructs enriched prompts with context
- Stores vectors and documents

### 2. OpenSearch Serverless Collection
- Type: VECTORSEARCH
- Dimensions: 1536 (Titan Embeddings)
- Similarity: Cosine
- Auto-scaling with on-demand OCUs

### 3. Bedrock Knowledge Base
- Monitors S3 for new documents
- Generates embeddings automatically
- Indexes in OpenSearch
- Provides retrieval API for Agent

### 4. S3 Knowledge Base Bucket
- Stores formatted JSON documents
- Organized by date (YYYY/MM/DD)
- Automatic sync to Knowledge Base

### 5. Bedrock Agent (Enhanced)
- Queries Knowledge Base for context
- Provides cited responses
- Uses Nova Premier model

## Implementation Phases

### Phase 1: Infrastructure (Tasks 1-2)
- Deploy OpenSearch Serverless collection
- Create Bedrock Knowledge Base
- Set up S3 bucket and IAM roles

### Phase 2: Core RAG Logic (Tasks 3-6)
- Implement embedding generation
- Build vector storage and search
- Enhance Processor Lambda
- Add S3 document sync

### Phase 3: Integration (Tasks 7-9)
- Update DynamoDB schema
- Integrate Bedrock Agent with KB
- Create semantic search API

### Phase 4: Observability (Task 10)
- CloudWatch dashboards
- Alarms for failures and latency
- Structured logging

### Phase 5: Data Migration (Task 11)
- Backfill historical insights
- Generate embeddings for existing data
- Populate vector database

### Phase 6: Frontend & Optimization (Tasks 12-13)
- Source attribution UI
- Query caching
- Performance optimization

### Phase 7: Documentation (Task 15)
- Update README
- Deployment guide
- API documentation

## Testing Strategy

### Property-Based Tests (10 properties)
1. Embedding generation consistency
2. Vector storage completeness
3. Retrieval relevance ordering
4. Historical context inclusion
5. Fallback behavior preservation
6. S3 document format validity
7. Similarity score threshold
8. Knowledge base sync idempotency
9. Source attribution completeness
10. Embedding dimension consistency

### Integration Tests
- End-to-end RAG flow
- Bedrock Agent with Knowledge Base
- Failure recovery scenarios

### Performance Tests
- Vector search latency (target: <500ms p95)
- Embedding generation throughput
- Knowledge Base sync time

## Cost Impact

### Additional Monthly Costs
- **OpenSearch Serverless**: ~$700/month (4 OCUs, on-demand)
- **Titan Embeddings**: ~$0.20/month (2M tokens)
- **S3 Storage**: ~$0.23/month (10GB)
- **Total**: ~$700/month additional

### Cost Optimization Strategies
- On-demand OCUs (scale to zero when idle)
- Embedding caching for common queries
- Batch processing
- S3 lifecycle policies

## Rollout Strategy

1. **Deploy infrastructure** (feature flag disabled)
2. **Test with 10% traffic** (monitor errors)
3. **Backfill historical data** (batch job)
4. **Enable for beta users** (collect feedback)
5. **Full rollout** (100% traffic)

## Success Metrics

### Performance
- Vector search p95 latency < 500ms
- Embedding generation success rate > 95%
- Knowledge Base sync within 5 minutes

### Quality
- RAG usage rate (% of insights using context)
- Average similarity scores
- User feedback on source attribution

### Reliability
- OpenSearch availability > 99.9%
- Fallback success rate 100%
- Error rate < 1%

## Risk Mitigation

### High Cost Risk
- **Mitigation**: Use on-demand OCUs, implement caching, monitor usage
- **Fallback**: Disable RAG if costs exceed budget

### Performance Degradation
- **Mitigation**: Circuit breakers, query optimization, result caching
- **Fallback**: Reduce retrieval limit, disable for high-load periods

### Data Quality Issues
- **Mitigation**: Validate embeddings, monitor similarity scores
- **Fallback**: Manual review of low-quality results

### OpenSearch Unavailability
- **Mitigation**: Automatic fallback to DynamoDB-only queries
- **Fallback**: System continues functioning without RAG

## Next Steps

To begin implementation:

1. **Review the spec documents**:
   - `requirements.md` - 10 requirements with acceptance criteria
   - `design.md` - Detailed architecture and design decisions
   - `tasks.md` - 16 major tasks with 60+ sub-tasks

2. **Start with Task 1**: Set up OpenSearch Serverless infrastructure

3. **Execute tasks sequentially**, testing after each major component

4. **Monitor progress** using the task checkboxes

5. **Ask questions** if any requirements or design decisions are unclear

## Questions?

- Need clarification on any requirement?
- Want to adjust the architecture?
- Concerned about costs or performance?
- Ready to start implementation?

**The spec is complete and ready for implementation!** 🚀
