# RAG Implementation Guide - Quick Start

## 🎯 What You're Building

You're adding **Retrieval Augmented Generation (RAG)** to your CI Alert System, transforming it from simple AI analysis into a context-aware pharmaceutical intelligence platform that learns from historical insights.

## 📋 Spec Location

All specification documents are in: `.kiro/specs/rag-implementation/`

- **requirements.md** - 10 requirements with acceptance criteria
- **design.md** - Complete architecture and design
- **tasks.md** - 16 major tasks (60+ sub-tasks)
- **SUMMARY.md** - Executive overview

## 🚀 How to Start Implementation

### Option 1: Execute Tasks with Kiro

1. Open `.kiro/specs/rag-implementation/tasks.md`
2. Click "Start task" next to Task 1
3. Kiro will guide you through implementation
4. Complete tasks sequentially

### Option 2: Manual Implementation

Follow the tasks in order:

```bash
# Task 1: Set up OpenSearch Serverless
cd infrastructure
# Update bedrock-agent-stack.ts to add OpenSearch collection

# Task 2: Deploy Bedrock Knowledge Base
# Add Knowledge Base resource to CDK stack

# Task 3: Implement embedding utilities
cd ../lambdas/processing
# Create embedding_service.py

# ... continue through tasks
```

## 📊 Current vs Future State

### Current (No RAG)
```
PubMed → Processor → Nova Lite → DynamoDB
                     (no context)
```

### Future (With RAG)
```
PubMed → Processor → Search Vector DB → Retrieve Context
                  ↓
         Nova Lite + Historical Context → DynamoDB + OpenSearch + S3
                  ↓
         Bedrock Agent ← Knowledge Base ← S3 Documents
```

## 💰 Cost Impact

**Additional Monthly Cost**: ~$700
- OpenSearch Serverless: $700 (4 OCUs on-demand)
- Titan Embeddings: $0.20
- S3 Storage: $0.23

**Optimization**: OCUs scale to zero when idle, reducing costs during low usage.

## 🔑 Key Technologies

| Technology | Purpose | Cost |
|------------|---------|------|
| **OpenSearch Serverless** | Vector database | $700/mo |
| **Titan Embeddings** | Text → vectors (1536-dim) | $0.10/1M tokens |
| **Bedrock Knowledge Base** | RAG orchestration | Included |
| **S3** | Document storage | $0.023/GB |
| **Nova Lite** | AI with context | Existing |
| **Nova Premier** | Agent queries | Existing |

## 📈 Implementation Timeline

| Phase | Tasks | Duration | Deliverable |
|-------|-------|----------|-------------|
| **1. Infrastructure** | 1-2 | 2-3 days | OpenSearch + KB deployed |
| **2. Core RAG** | 3-6 | 5-7 days | Embeddings + vector storage |
| **3. Integration** | 7-9 | 3-4 days | Agent + search API |
| **4. Observability** | 10 | 1-2 days | Monitoring dashboard |
| **5. Migration** | 11 | 2-3 days | Historical data backfill |
| **6. Frontend** | 12-13 | 2-3 days | UI + optimization |
| **7. Documentation** | 15 | 1 day | Guides + API docs |
| **Total** | | **16-23 days** | Production-ready RAG |

## ✅ Success Criteria

### Performance
- [ ] Vector search < 500ms (p95)
- [ ] Embedding generation > 95% success rate
- [ ] Knowledge Base sync < 5 minutes

### Quality
- [ ] RAG provides context for 80%+ of insights
- [ ] Average similarity scores > 0.75
- [ ] Source attribution visible in UI

### Reliability
- [ ] OpenSearch availability > 99.9%
- [ ] Fallback works 100% when RAG fails
- [ ] Error rate < 1%

## 🧪 Testing Requirements

### Property-Based Tests (All Required)
1. ✅ Embedding consistency
2. ✅ Vector storage completeness
3. ✅ Retrieval ordering
4. ✅ Context inclusion
5. ✅ Fallback preservation
6. ✅ Document format validity
7. ✅ Similarity threshold
8. ✅ Sync idempotency
9. ✅ Source attribution
10. ✅ Dimension consistency

### Integration Tests
- End-to-end RAG flow
- Bedrock Agent with KB
- Failure recovery

### Performance Tests
- 100K vectors, 1000 concurrent searches
- Latency benchmarks
- Throughput testing

## 🎓 Key Concepts

### What is RAG?
**Retrieval Augmented Generation** = Retrieve relevant context + Generate AI response

Instead of:
```python
response = ai.generate(prompt)
```

You do:
```python
context = vector_db.search(prompt)  # Retrieve
response = ai.generate(prompt + context)  # Augment + Generate
```

### What are Embeddings?
Text converted to numbers (vectors) that capture semantic meaning:
```python
"Keytruda shows promise" → [0.23, -0.45, 0.67, ..., 0.12]  # 1536 numbers
"Opdivo demonstrates efficacy" → [0.21, -0.43, 0.69, ..., 0.15]  # Similar!
```

Similar meanings = similar vectors (measured by cosine similarity)

### What is a Vector Database?
Database optimized for finding similar vectors:
```python
query = "cancer treatment breakthrough"
query_vector = embed(query)
results = vector_db.search(query_vector, top_k=5)
# Returns 5 most similar insights
```

## 🔧 Development Workflow

### 1. Read the Spec
- Start with `SUMMARY.md` for overview
- Read `requirements.md` for what to build
- Study `design.md` for how to build it
- Follow `tasks.md` for step-by-step implementation

### 2. Set Up Environment
```bash
# Enable Bedrock models
aws bedrock list-foundation-models --region us-east-1

# Verify Titan Embeddings access
aws bedrock invoke-model \
  --model-id amazon.titan-embed-text-v1 \
  --region us-east-1 \
  --body '{"inputText":"test"}'
```

### 3. Deploy Infrastructure First
```bash
cd infrastructure
npm install
npm run build
cdk deploy CIAlert-BedrockAgent
```

### 4. Implement Core Logic
```bash
cd ../lambdas/processing
# Create embedding_service.py
# Update processor.py with RAG
```

### 5. Test Thoroughly
```bash
# Run property tests
pytest tests/test_rag_properties.py

# Run integration tests
pytest tests/test_rag_integration.py
```

### 6. Deploy Gradually
- Deploy with feature flag disabled
- Test with 10% traffic
- Monitor metrics
- Full rollout

## 📚 Resources

### AWS Documentation
- [OpenSearch Serverless](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html)
- [Bedrock Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [Titan Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html)

### Your Project Files
- `processor.py` - Current implementation (to be enhanced)
- `bedrock-agent-stack.ts` - Infrastructure (to be updated)
- `ARCHITECTURE.txt` - Current architecture

## 🆘 Getting Help

### Common Questions

**Q: Do I need to implement everything at once?**
A: No! Follow the phased approach. Start with infrastructure, then core RAG, then enhancements.

**Q: What if OpenSearch is too expensive?**
A: Use on-demand OCUs (scale to zero), implement caching, or start with a smaller collection.

**Q: Can I use a different vector database?**
A: Yes, but you'll need to modify the design. OpenSearch Serverless integrates best with Bedrock.

**Q: How do I test without deploying?**
A: Use LocalStack for OpenSearch, or mock the vector DB in tests.

**Q: What if I get stuck on a task?**
A: Ask Kiro for help! Open the task and click "Start task" for guided implementation.

## 🎯 Next Steps

1. **Review the spec**: Read all documents in `.kiro/specs/rag-implementation/`
2. **Ask questions**: Clarify anything unclear before starting
3. **Start Task 1**: Open `tasks.md` and begin with infrastructure
4. **Test frequently**: Run tests after each major component
5. **Monitor progress**: Check off tasks as you complete them

## 🚀 Ready to Begin?

Open `.kiro/specs/rag-implementation/tasks.md` and click "Start task" next to Task 1!

---

**Good luck with your RAG implementation!** 🎉

This will transform your CI Alert System into a truly intelligent pharmaceutical competitive intelligence platform.
