# AI Model & Agent Pipeline Documentation

## Overview

The CI Alert System uses Amazon Bedrock with Claude 3.5 models and RAG knowledge base for AI-powered pharmaceutical competitive intelligence analysis.

---

## Architecture

```
PubMed API → Lambda Ingestion → SQS Queue → Processor Lambda → Claude 3.5 Haiku → DynamoDB
                                                    ↓
                                            AI Analysis + RAG:
                                            - Sentiment Analysis
                                            - Risk Assessment
                                            - Opportunities
                                            - Strategic Summary
                                            - Knowledge Base Search

User Chat → Bedrock Agent → Claude 3.5 Sonnet v2 + Knowledge Base → Cited Responses
```

---

## Components

### 1. Data Ingestion (PubMed Lambda)

**File:** `lambdas/ingestion/pubmed_ingestion.py`

**Purpose:** Fetches pharmaceutical news from PubMed API

**Process:**
1. Receives molecule name as input
2. Queries PubMed API with search terms
3. Retrieves article metadata (title, abstract, authors, date)
4. Packages data into SQS message
5. Sends to processing queue

**API Endpoint:** `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`

**Example Query:**
```python
search_term = f"{molecule} AND (clinical trial OR FDA approval OR drug development)"
params = {
    'db': 'pubmed',
    'term': search_term,
    'retmax': 10,
    'sort': 'date'
}
```

**Output to SQS:**
```json
{
  "molecule": "Keytruda",
  "content": "Article title and abstract...",
  "source": "PubMed",
  "pubmed_id": "12345678",
  "date": "2024-01-15"
}
```

---

### 2. Message Queue (SQS)

**Purpose:** Decouples ingestion from processing

**Configuration:**
- Visibility Timeout: 300 seconds (5 minutes)
- Retention Period: 14 days
- Batch Size: 10 messages
- Max Batching Window: 5 seconds

**Benefits:**
- Handles traffic spikes
- Retry failed processing
- Scales independently
- Dead letter queue for failures

---

### 3. AI Processing (Processor Lambda)

**File:** `lambdas/processing/processor.py`

**Purpose:** Analyzes pharmaceutical news with Amazon Nova Lite

**Process:**
1. Receives messages from SQS
2. Constructs AI prompt with molecule and content
3. Calls Amazon Nova Lite
4. Parses AI response
5. Stores insights in DynamoDB

**Bedrock Configuration:**
```python
bedrock = boto3.client('bedrock-runtime')

# Batch processing with Claude 3.5 Haiku (cost-effective)
response = bedrock.invoke_model(
    modelId='anthropic.claude-3-5-haiku-20241022-v1:0',
    body=json.dumps({
        'anthropic_version': 'bedrock-2023-05-31',
        'max_tokens': 1000,
        'messages': [{'role': 'user', 'content': prompt}]
    })
)

# Interactive queries with Bedrock Agent (Claude 3.5 Sonnet v2)
bedrock_agent = boto3.client('bedrock-agent-runtime')
response = bedrock_agent.invoke_agent(
    agentId=AGENT_ID,
    agentAliasId=AGENT_ALIAS_ID,
    sessionId=session_id,
    inputText=user_query
)
```

---

## AI Prompt Engineering

### Prompt Template

```python
PROMPT_TEMPLATE = """Analyze this pharmaceutical news and provide competitive intelligence insights.

Molecule: {molecule}
Content: {content}

Provide a structured analysis with:
1. Headline (one sentence)
2. Sentiment (Positive/Neutral/Negative)
3. Key Risks (2 points max)
4. Key Opportunities (2 points max)
5. Strategic Summary (5 bullets)

Format as JSON."""
```

### Example Input

```
Molecule: Keytruda
Content: Merck announces FDA approval of Keytruda for first-line treatment of advanced melanoma. 
Phase III trial showed 45% improvement in overall survival vs chemotherapy. 
Market analysts project $5B in annual sales by 2025.
```

### Example AI Output

```json
{
  "headline": "FDA approves Keytruda for first-line melanoma, major competitive threat",
  "sentiment": "Negative",
  "risks": [
    "Direct competition in melanoma market with 45% survival advantage",
    "Projected $5B sales will capture significant market share"
  ],
  "opportunities": [
    "Potential combination therapy partnerships",
    "Identify unmet needs in resistant patient populations"
  ],
  "summary": [
    "FDA approval expands Keytruda's label to first-line melanoma",
    "Phase III data shows strong efficacy vs standard chemotherapy",
    "Market entry threatens existing melanoma therapies",
    "Consider accelerating competing checkpoint inhibitor programs",
    "Evaluate combination strategies to differentiate"
  ]
}
```

---

## Model Selection

### Why Claude 3.5 Models?

**Claude 3.5 Haiku (Batch Processing):**
- **Cost-effective:** $0.25/$1.25 per 1M tokens (10x cheaper than Sonnet)
- **Fast:** Low latency for batch processing
- **Accurate:** Excellent for pharmaceutical text analysis
- **Context Window:** 200K tokens (handles long articles)
- **JSON Output:** Reliable structured responses

**Claude 3.5 Sonnet v2 (Interactive Agent):**
- **Advanced Reasoning:** Superior for complex queries
- **RAG Integration:** Works seamlessly with Knowledge Base
- **Citations:** Provides source references
- **Context Window:** 200K tokens
- **Cost:** $3/$15 per 1M tokens

**2-Model Architecture Benefits:**
- **Cost Optimization:** Save $13.50/month vs single Sonnet
- **Performance:** Right model for each use case
- **Scalability:** Haiku handles high-volume processing

**Alternatives Considered:**
- Single Claude 3.5 Sonnet: More expensive for batch processing
- Amazon Nova models: Less mature, limited availability
- GPT-4: Not available on Bedrock, higher latency

---

## Performance Optimization

### Batch Processing
```python
# Process up to 10 messages per Lambda invocation
for record in event['Records']:
    message = json.loads(record['body'])
    # Process each message
```

### Caching Strategy
```python
# Cache common molecules to reduce API calls
MOLECULE_CACHE = {}

def get_molecule_context(molecule):
    if molecule in MOLECULE_CACHE:
        return MOLECULE_CACHE[molecule]
    # Fetch from DynamoDB or external API
    context = fetch_molecule_info(molecule)
    MOLECULE_CACHE[molecule] = context
    return context
```

### Error Handling
```python
try:
    response = bedrock.invoke_model(...)
except ClientError as e:
    if e.response['Error']['Code'] == 'ThrottlingException':
        # Retry with exponential backoff
        time.sleep(2 ** retry_count)
    elif e.response['Error']['Code'] == 'ModelNotReadyException':
        # Model not enabled, log error
        logger.error("Bedrock model not enabled")
    else:
        raise
```

---

## Data Storage (DynamoDB)

### InsightsTable Schema

```
{
  "molecule": "Keytruda",              // Partition Key
  "timestamp": "2024-01-15T10:30:00Z", // Sort Key
  "insights": "{...}",                 // AI-generated JSON
  "source": "PubMed",
  "raw_content": "Article text...",    // First 1000 chars
  "pubmed_id": "12345678",
  "sentiment": "Negative",
  "impact": "High"
}
```

### Query Patterns

**Get all insights for a molecule:**
```python
response = table.query(
    KeyConditionExpression=Key('molecule').eq('Keytruda'),
    ScanIndexForward=False,  # Sort by timestamp descending
    Limit=10
)
```

**Get recent insights across all molecules:**
```python
response = table.scan(
    FilterExpression=Attr('timestamp').gt(yesterday),
    Limit=50
)
```

---

## Monitoring & Metrics

### CloudWatch Metrics

**Processor Lambda:**
- Invocations: Number of processing runs
- Duration: Time to process each batch
- Errors: Failed processing attempts
- Throttles: Bedrock rate limit hits

**Custom Metrics:**
```python
cloudwatch = boto3.client('cloudwatch')

cloudwatch.put_metric_data(
    Namespace='CIAlert',
    MetricData=[{
        'MetricName': 'InsightsGenerated',
        'Value': 1,
        'Unit': 'Count',
        'Dimensions': [
            {'Name': 'Molecule', 'Value': molecule},
            {'Name': 'Sentiment', 'Value': sentiment}
        ]
    }]
)
```

### Logging

```python
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

logger.info(f"Processing molecule: {molecule}")
logger.info(f"Bedrock response time: {duration}ms")
logger.error(f"Failed to process: {error}")
```

---

## Cost Analysis

### Per-Insight Cost Breakdown

**Assumptions:**
- 1 article = 500 tokens input
- 1 analysis = 200 tokens output
- 100 insights/day

**Monthly Costs (100 insights/day, 100 agent queries/day):**

**Batch Processing (Claude 3.5 Haiku):**
```
Input:  100 insights/day × 30 days × 500 tokens = 1.5M tokens
        1.5M × $0.25/1M = $0.375

Output: 100 insights/day × 30 days × 200 tokens = 600K tokens
        600K × $1.25/1M = $0.75

Subtotal: $1.125/month
```

**Interactive Agent (Claude 3.5 Sonnet v2):**
```
Input:  100 queries/day × 30 days × 1000 tokens = 3M tokens
        3M × $3/1M = $9.00

Output: 100 queries/day × 30 days × 500 tokens = 1.5M tokens
        1.5M × $15/1M = $22.50

Subtotal: $31.50/month
```

**RAG Components:**
```
Titan Embeddings: 1M tokens/month × $0.0001 = $0.10
OpenSearch Serverless: 2 OCUs = $55/month
Subtotal: $55.10/month
```

**Total AI Pipeline Cost: $87.73/month**

**Cost Savings vs Single Model:**
- All Sonnet v2: $120/month
- 2-Model Approach: $87.73/month
- **Savings: $32.27/month (27% reduction)**

### Cost Optimization Tips

1. **Batch Processing:** Process multiple articles per Lambda invocation
2. **Prompt Optimization:** Reduce output tokens by requesting concise summaries
3. **Caching:** Cache molecule context to reduce redundant API calls
4. **Filtering:** Pre-filter irrelevant articles before sending to Bedrock
5. **Model Selection:** Use Claude Haiku for simple analyses

---

## Advanced Features

### RAG Knowledge Base Integration

**Current Implementation:** OpenSearch Serverless with Bedrock Knowledge Base

```python
# Upload documents to knowledge base
def sync_documents_to_kb():
    # Upload to S3 documents/ prefix
    s3.upload_file('fda-approval.pdf', KB_BUCKET, 'documents/regulatory/fda-approval.pdf')
    
    # Trigger ingestion job
    bedrock_agent.start_ingestion_job(
        knowledgeBaseId=KB_ID,
        dataSourceId=DS_ID
    )

# Search knowledge base via agent
def search_knowledge_base(query):
    response = bedrock_agent.invoke_agent(
        agentId=AGENT_ID,
        agentAliasId=AGENT_ALIAS_ID,
        inputText=f"Search knowledge base: {query}"
    )
    return response
```

### Multi-Source Aggregation

**Enhanced with RAG:** Combine real-time data with historical knowledge

```python
sources = ['PubMed', 'ClinicalTrials.gov', 'FDA', 'SEC']

for source in sources:
    # Fetch real-time data
    data = fetch_from_source(source, molecule)
    
    # Analyze with context from knowledge base
    context = search_knowledge_base(f"{molecule} historical data")
    insights = analyze_with_context(data, context)
    
    # Store and update knowledge base
    store_insights(insights)
    update_knowledge_base(insights)
```

### Sentiment Trending

**Track sentiment over time:**

```python
def calculate_sentiment_trend(molecule, days=30):
    insights = get_insights_for_period(molecule, days)
    sentiments = [i['sentiment'] for i in insights]
    
    positive_count = sentiments.count('Positive')
    negative_count = sentiments.count('Negative')
    
    trend = (positive_count - negative_count) / len(sentiments)
    return trend  # -1 to +1
```

### Impact Scoring

**Prioritize high-impact insights:**

```python
def calculate_impact_score(insight):
    score = 0
    
    # FDA approval = high impact
    if 'FDA approval' in insight['content']:
        score += 10
    
    # Phase III trial = medium impact
    if 'Phase III' in insight['content']:
        score += 5
    
    # Negative sentiment = higher priority
    if insight['sentiment'] == 'Negative':
        score += 3
    
    return score
```

---

## Testing & Validation

### Unit Tests

```python
def test_bedrock_integration():
    # Mock Bedrock response
    mock_response = {
        'body': json.dumps({
            'content': [{'text': '{"headline": "Test"}'}]
        })
    }
    
    # Test processor
    result = process_insight(test_molecule, test_content)
    assert result['headline'] == 'Test'
```

### Integration Tests

```bash
# Test full pipeline
bash test.sh ingestion

# Verify insights created
INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text)
aws dynamodb scan --table-name $INSIGHTS_TABLE --max-items 5
```

### Load Testing

```python
# Simulate 100 concurrent ingestions
import concurrent.futures

def ingest_molecule(molecule):
    lambda_client.invoke(
        FunctionName='PubMedFunction',
        InvocationType='Event',
        Payload=json.dumps({'molecule': molecule})
    )

with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    molecules = ['Keytruda', 'Opdivo', 'Tecentriq'] * 33
    executor.map(ingest_molecule, molecules)
```

---

## Troubleshooting

### Issue: Bedrock returns empty response
**Solution:** 
- Check Claude 3.5 models enabled in AWS Console → Bedrock → Model Access
- Verify region supports Claude 3.5 models (us-east-1, us-west-2)
- Check IAM permissions for bedrock:InvokeModel

### Issue: Knowledge Base search returns no results
**Solution:**
- Verify documents uploaded to S3 documents/ prefix
- Check ingestion job status: `aws bedrock-agent list-ingestion-jobs --knowledge-base-id $KB_ID`
- Ensure OpenSearch Serverless collection is active
- Verify vector index created: `ci-alert-index`

### Issue: Agent preparation fails
**Solution:**
- Run: `aws bedrock-agent prepare-agent --agent-id $AGENT_ID`
- Check agent has knowledge base associated
- Verify action group Lambda permissions

### Issue: Insights not stored in DynamoDB
**Solution:** Check Lambda IAM permissions for DynamoDB write

### Issue: High latency (>10 seconds)
**Solution:** Reduce maxTokens in inferenceConfig

### Issue: JSON parsing errors
**Solution:** Add retry logic with prompt refinement

---

## Current RAG Implementation

1. **✅ Knowledge Base:** Bedrock Knowledge Base with OpenSearch Serverless
2. **✅ Agent Framework:** Bedrock Agent with multi-step reasoning
3. **✅ Vector Search:** Hybrid search (semantic + keyword)
4. **✅ Document Processing:** Auto-sync S3 uploads to knowledge base
5. **✅ Interactive Chat:** React frontend with agent integration

## Future Enhancements

1. **Fine-tuning:** Custom model for pharmaceutical domain
2. **Multi-modal:** Analyze charts/graphs from publications
3. **Real-time Streaming:** WebSocket updates for live insights
4. **Advanced RAG:** Multi-hop reasoning across documents
5. **Federated Search:** Query multiple knowledge bases

---

## References

- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude 3.5 Model Card](https://www.anthropic.com/claude)
- [Bedrock Knowledge Base Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [OpenSearch Serverless Documentation](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html)
- [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
