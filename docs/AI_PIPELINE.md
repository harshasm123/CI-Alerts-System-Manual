# AI Model & Agent Pipeline Documentation

## Overview

The CI Alert System uses Amazon Bedrock with Amazon Nova Lite for AI-powered pharmaceutical competitive intelligence analysis.

---

## Architecture

```
PubMed API → Lambda Ingestion → SQS Queue → Processor Lambda → Amazon Nova Lite → DynamoDB
                                                    ↓
                                            AI Analysis:
                                            - Sentiment
                                            - Risks
                                            - Opportunities
                                            - Strategic Summary
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

response = bedrock.invoke_model(
    modelId='us.amazon.nova-lite-v1:0',
    body=json.dumps({
        'messages': [{'role': 'user', 'content': [{'text': prompt}]}],
        'inferenceConfig': {
        'max_tokens': 1000,
        'messages': [{'role': 'user', 'content': prompt}]
    })
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

### Why Amazon Nova Lite?

**Advantages:**
- **Cost-effective:** $0.06/$0.24 per 1M tokens (60-75% cheaper than Claude)
- **Fast:** Low latency for batch processing
- **Accurate:** Excellent for pharmaceutical text analysis
- **Context Window:** 200K tokens (handles long articles)
- **Accuracy:** High precision for medical/scientific text
- **Speed:** 2-3 seconds per analysis
- **Cost:** $3 per 1M input tokens, $15 per 1M output tokens
- **JSON Output:** Reliable structured responses

**Alternatives Considered:**
- Amazon Nova Premier: More advanced but more expensive (for Bedrock Agent)
- Claude models: More expensive, similar performance
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

**Monthly Costs:**
```
Input:  100 insights/day × 30 days × 500 tokens = 1.5M tokens
        1.5M × $3/1M = $4.50

Output: 100 insights/day × 30 days × 200 tokens = 600K tokens
        600K × $15/1M = $9.00

Lambda: 100 invocations/day × 30 days × 5 seconds × $0.0000166667/GB-second
        = $0.25 (with 512MB memory)

Total:  $13.75/month
```

### Cost Optimization Tips

1. **Batch Processing:** Process multiple articles per Lambda invocation
2. **Prompt Optimization:** Reduce output tokens by requesting concise summaries
3. **Caching:** Cache molecule context to reduce redundant API calls
4. **Filtering:** Pre-filter irrelevant articles before sending to Bedrock
5. **Model Selection:** Use Claude Haiku for simple analyses

---

## Advanced Features

### Multi-Source Aggregation

**Future Enhancement:** Combine data from multiple sources

```python
sources = ['PubMed', 'ClinicalTrials.gov', 'FDA', 'SEC']

for source in sources:
    data = fetch_from_source(source, molecule)
    insights = analyze_with_bedrock(data)
    aggregate_insights(insights)
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
**Solution:** Check model is enabled in AWS Console

### Issue: Insights not stored in DynamoDB
**Solution:** Check Lambda IAM permissions for DynamoDB write

### Issue: High latency (>10 seconds)
**Solution:** Reduce maxTokens in inferenceConfig

### Issue: JSON parsing errors
**Solution:** Add retry logic with prompt refinement

---

## Future Enhancements

1. **Knowledge Base:** Use Bedrock Knowledge Base for RAG
2. **Agent Framework:** Implement Bedrock Agents for multi-step reasoning
3. **Fine-tuning:** Custom model for pharmaceutical domain
4. **Multi-modal:** Analyze charts/graphs from publications
5. **Real-time Streaming:** WebSocket updates for live insights

---

## References

- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude 3 Model Card](https://www.anthropic.com/claude)
- [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
