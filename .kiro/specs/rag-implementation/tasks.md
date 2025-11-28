# Implementation Plan

- [ ] 1. Set up OpenSearch Serverless infrastructure
  - Create OpenSearch Serverless collection with VECTORSEARCH type
  - Configure collection with 1536-dimensional vector support
  - Set up IAM roles and policies for Lambda access
  - Create vector index with proper schema (embedding, metadata fields)
  - _Requirements: 4.2, 4.3_

- [ ] 2. Deploy Bedrock Knowledge Base
  - [ ] 2.1 Create S3 bucket for knowledge base documents
    - Configure bucket encryption and lifecycle policies
    - Set up folder structure (insights/YYYY/MM/DD/)
    - Configure IAM policies for Bedrock access
    - _Requirements: 4.5, 6.3_

  - [ ] 2.2 Create Bedrock Knowledge Base resource
    - Configure with Amazon Titan Embeddings model
    - Link to OpenSearch Serverless collection
    - Set up S3 data source
    - Configure automatic sync settings
    - _Requirements: 4.3, 4.4, 6.4_

  - [ ] 2.3 Configure Knowledge Base data source
    - Point to S3 bucket insights/ prefix
    - Set chunking strategy to NONE (pre-formatted docs)
    - Configure sync schedule
    - Test manual sync
    - _Requirements: 4.5, 6.4_

- [ ] 3. Implement embedding generation utilities
  - [ ] 3.1 Create embedding service module
    - Implement generate_embedding() function using Titan Embeddings
    - Add retry logic with exponential backoff
    - Implement error handling and logging
    - Add CloudWatch metrics emission
    - _Requirements: 2.2, 9.1_

  - [ ] 3.2 Write property test for embedding generation
    - **Property 1: Embedding generation consistency**
    - **Validates: Requirements 2.2**

  - [ ] 3.3 Implement embedding caching
    - Cache embeddings for common queries
    - Set TTL to 1 hour
    - Implement cache invalidation logic
    - _Requirements: 8.5_

- [ ] 4. Implement vector storage in OpenSearch
  - [ ] 4.1 Create OpenSearch client wrapper
    - Implement store_vector() function
    - Implement search_similar_insights() function
    - Add connection pooling and retry logic
    - Implement circuit breaker pattern
    - _Requirements: 2.4, 3.1, 9.2_

  - [ ] 4.2 Write property test for vector storage
    - **Property 2: Vector storage completeness**
    - **Validates: Requirements 2.4**

  - [ ] 4.3 Implement vector search with filtering
    - Add molecule name filtering
    - Add date range filtering
    - Implement similarity threshold (0.7)
    - Add result ranking by similarity score
    - _Requirements: 3.3, 3.4, 7.4_

  - [ ] 4.4 Write property test for retrieval ordering
    - **Property 3: Retrieval relevance ordering**
    - **Validates: Requirements 3.3**

  - [ ] 4.5 Write property test for similarity threshold
    - **Property 7: Similarity score threshold**
    - **Validates: Requirements 7.4**

- [ ] 5. Enhance Processor Lambda with RAG
  - [ ] 5.1 Update processor.py with RAG workflow
    - Add embedding generation for incoming articles
    - Implement vector search for historical context
    - Construct enriched prompts with context
    - Update Nova Lite API calls with context
    - Store sources field in DynamoDB insights
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ] 5.2 Write property test for context inclusion
    - **Property 4: Historical context inclusion**
    - **Validates: Requirements 1.2, 1.4**

  - [ ] 5.3 Implement fallback logic for RAG failures
    - Add try-catch blocks around RAG operations
    - Implement fallback to non-RAG processing
    - Emit CloudWatch metrics for failures
    - Log errors with context
    - _Requirements: 9.1, 9.2, 9.4_

  - [ ] 5.4 Write property test for fallback behavior
    - **Property 5: Fallback behavior preservation**
    - **Validates: Requirements 9.1, 9.4**

  - [ ] 5.5 Add feature flag for RAG enablement
    - Read from environment variable RAG_ENABLED
    - Default to false for safe rollout
    - Log RAG usage status
    - _Requirements: Deployment_

- [ ] 6. Implement S3 knowledge base sync
  - [ ] 6.1 Create S3 document writer
    - Implement write_to_knowledge_base() function
    - Format insights as JSON documents
    - Organize by date hierarchy (YYYY/MM/DD/)
    - Add retry logic for S3 writes
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 6.2 Write property test for document format
    - **Property 6: S3 document format validity**
    - **Validates: Requirements 6.2**

  - [ ] 6.3 Implement automatic sync trigger
    - Call write_to_knowledge_base() after DynamoDB storage
    - Handle sync failures gracefully
    - Emit CloudWatch metrics for sync status
    - _Requirements: 6.1, 6.4_

  - [ ] 6.4 Write property test for sync idempotency
    - **Property 8: Knowledge base sync idempotency**
    - **Validates: Requirements 6.4**

- [ ] 7. Update DynamoDB schema
  - [ ] 7.1 Add new fields to Insights table
    - Add sources field (list of source objects)
    - Add embedding_id field (string)
    - Add kb_document_path field (string)
    - Update table definition in CDK
    - _Requirements: 1.4, 10.1_

  - [ ] 7.2 Create migration script for existing data
    - Add empty sources arrays to existing insights
    - Set embedding_id and kb_document_path to null
    - Test migration on sample data
    - _Requirements: Deployment_

- [ ] 8. Enhance Bedrock Agent with Knowledge Base
  - [ ] 8.1 Update Bedrock Agent configuration
    - Attach Knowledge Base to Agent
    - Update agent instructions for KB usage
    - Configure KB query settings
    - Test agent with KB queries
    - _Requirements: 5.1, 5.2_

  - [ ] 8.2 Implement source citation in agent responses
    - Parse KB retrieval results
    - Format citations in agent responses
    - Include similarity scores
    - _Requirements: 5.3, 10.2_

  - [ ] 8.3 Add error handling for KB query failures
    - Implement timeout handling (5 seconds)
    - Add fallback to foundation model only
    - Emit CloudWatch metrics
    - Include disclaimer in responses
    - _Requirements: 5.4, 5.5, 9.5_

- [ ] 9. Implement semantic search API endpoint
  - [ ] 9.1 Create new Lambda function for semantic search
    - Accept query text or reference article
    - Generate query embedding
    - Search OpenSearch for similar insights
    - Return top 10 results with scores
    - _Requirements: 3.1, 3.2, 7.1_

  - [ ] 9.2 Add API Gateway endpoint
    - Create POST /search/semantic endpoint
    - Add Cognito authorization
    - Configure request/response models
    - Add rate limiting
    - _Requirements: 3.1_

  - [ ] 9.3 Implement result merging
    - Combine DynamoDB keyword search results
    - Merge with OpenSearch semantic results
    - Deduplicate by insight_id
    - Sort by relevance score
    - _Requirements: 3.5_

  - [ ] 9.4 Write property test for source attribution
    - **Property 9: Source attribution completeness**
    - **Validates: Requirements 10.2**

- [ ] 10. Add monitoring and observability
  - [ ] 10.1 Create CloudWatch dashboard
    - Add RAG usage metrics
    - Add embedding generation metrics
    - Add vector search latency metrics
    - Add error rate metrics
    - _Requirements: 9.5_

  - [ ] 10.2 Configure CloudWatch alarms
    - Embedding failure rate > 5%
    - Vector search p95 latency > 500ms
    - OpenSearch unavailable > 5 minutes
    - KB sync failures > 10/hour
    - _Requirements: 8.2, 9.5_

  - [ ] 10.3 Implement structured logging
    - Log all RAG operations with context
    - Include insight_id, molecule, operation type
    - Log similarity scores and retrieval counts
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 11. Create backfill script for historical data
  - [ ] 11.1 Implement batch embedding generation
    - Query all existing insights from DynamoDB
    - Generate embeddings in batches of 100
    - Store vectors in OpenSearch
    - Write documents to S3 KB bucket
    - _Requirements: Deployment_

  - [ ] 11.2 Add progress tracking and resumability
    - Track last processed insight_id
    - Support resume from checkpoint
    - Emit progress metrics
    - _Requirements: Deployment_

  - [ ] 11.3 Test backfill on sample data
    - Run on 1000 sample insights
    - Verify all vectors stored correctly
    - Verify KB sync completes
    - Verify search functionality works
    - _Requirements: Deployment_

- [ ] 12. Update frontend for source attribution
  - [ ] 12.1 Update Insights component
    - Display sources section if present
    - Show molecule, timestamp, similarity score
    - Add click handler to view source insight
    - _Requirements: 10.5_

  - [ ] 12.2 Create source detail modal
    - Display full source insight text
    - Show metadata (source, sentiment)
    - Add link to original article if available
    - _Requirements: 10.5_

- [ ] 13. Performance optimization
  - [ ] 13.1 Implement query result caching
    - Cache common molecule queries
    - Set TTL to 15 minutes
    - Implement cache warming for popular molecules
    - _Requirements: 8.5_

  - [ ] 13.2 Optimize OpenSearch queries
    - Add query filters before vector search
    - Reduce retrieval limit under high load
    - Implement query batching
    - _Requirements: 8.1, 8.2_

  - [ ] 13.3 Write property test for dimension consistency
    - **Property 10: Embedding dimension consistency**
    - **Validates: Requirements 2.2**

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Documentation and deployment
  - [ ] 15.1 Update README with RAG features
    - Document semantic search capabilities
    - Explain source attribution
    - Add cost estimates
    - _Requirements: Documentation_

  - [ ] 15.2 Create deployment guide
    - Document infrastructure deployment steps
    - Explain backfill process
    - Document rollout strategy
    - Add troubleshooting section
    - _Requirements: Documentation_

  - [ ] 15.3 Update API documentation
    - Document new semantic search endpoint
    - Update insight schema with sources field
    - Add example requests/responses
    - _Requirements: Documentation_

- [ ] 16. Final checkpoint - Verify production readiness
  - Ensure all tests pass, ask the user if questions arise.
