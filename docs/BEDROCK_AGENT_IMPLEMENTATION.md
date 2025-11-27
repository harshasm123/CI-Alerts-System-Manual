# Bedrock Agent Implementation Guide

## What is Bedrock Agent?

Bedrock Agents are autonomous AI agents that can:
- Break down complex tasks into steps
- Make API calls to external systems
- Query knowledge bases
- Use tools and functions
- Maintain conversation context
- Execute multi-step workflows

---

## Should You Use Bedrock Agent in This Project?

### ✅ YES - Use Bedrock Agent For:

1. **Complex Analysis Workflows**
   - Multi-step competitive intelligence analysis
   - Cross-reference multiple data sources
   - Generate comprehensive reports
   - Answer follow-up questions

2. **Interactive Queries**
   - "What are the latest developments for Keytruda?"
   - "Compare Opdivo and Tecentriq clinical trials"
   - "Summarize FDA approvals this month"
   - "What's the competitive landscape for melanoma?"

3. **Automated Research**
   - Fetch data from multiple sources (PubMed, FDA, ClinicalTrials)
   - Synthesize information across sources
   - Generate strategic recommendations
   - Create executive summaries

4. **Knowledge Base Integration**
   - Store historical insights in S3
   - Query past analyses
   - Build institutional knowledge
   - RAG (Retrieval Augmented Generation)

### ❌ Current Simple Approach (Without Agent)

```python
# Current: Single-step processing
def lambda_handler(event, context):
    message = json.loads(event['Records'][0]['body'])
    molecule = message['molecule']
    content = message['content']
    
    # Single API call to Bedrock
    prompt = f"Analyze this: {content}"
    response = bedrock.invoke_model(...)
    
    # Store result
    table.put_item(...)
```

**Limitations:**
- Single-step analysis only
- No follow-up questions
- Can't cross-reference data
- No conversation memory
- Limited context

---

## Bedrock Agent Architecture

### Enhanced Architecture with Agent

```
User Query → API Gateway → Lambda → Bedrock Agent
                                         ↓
                                    Action Groups:
                                    1. Query DynamoDB
                                    2. Fetch PubMed
                                    3. Search FDA
                                    4. Analyze Trends
                                         ↓
                                    Knowledge Base
                                    (S3 + OpenSearch)
                                         ↓
                                    Claude 3 Sonnet
                                         ↓
                                    Response
```

### Components

1. **Bedrock Agent:** Orchestrates the workflow
2. **Action Groups:** Define available tools/APIs
3. **Knowledge Base:** Historical data and documents
4. **Lambda Functions:** Execute actions
5. **S3 Bucket:** Store knowledge base documents

---

## Implementation Guide

### Step 1: Create Knowledge Base

```typescript
// infrastructure/lib/bedrock-agent-stack.ts
import * as bedrock from '@aws-cdk/aws-bedrock-alpha';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';

export class BedrockAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for knowledge base documents
    const knowledgeBaseBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // OpenSearch Serverless collection for vector storage
    const vectorCollection = new opensearch.CfnCollection(this, 'VectorCollection', {
      name: 'ci-alert-vectors',
      type: 'VECTORSEARCH',
      description: 'Vector storage for CI Alert knowledge base',
    });

    // Bedrock Knowledge Base
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: 'ci-alert-knowledge-base',
      roleArn: knowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1',
        },
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: vectorCollection.attrArn,
          vectorIndexName: 'ci-alert-index',
          fieldMapping: {
            vectorField: 'embedding',
            textField: 'text',
            metadataField: 'metadata',
          },
        },
      },
    });

    // Data source (S3 bucket)
    const dataSource = new bedrock.CfnDataSource(this, 'DataSource', {
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      name: 'ci-alert-documents',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: knowledgeBaseBucket.bucketArn,
        },
      },
    });
  }
}
```

### Step 2: Create Action Groups

```typescript
// Define action groups for the agent
const actionGroup = new bedrock.CfnAgentActionGroup(this, 'ActionGroup', {
  agentId: agent.attrAgentId,
  agentVersion: 'DRAFT',
  actionGroupName: 'ci-alert-actions',
  actionGroupExecutor: {
    lambda: actionLambda.functionArn,
  },
  apiSchema: {
    payload: JSON.stringify({
      openapi: '3.0.0',
      info: {
        title: 'CI Alert Actions API',
        version: '1.0.0',
      },
      paths: {
        '/query-insights': {
          post: {
            description: 'Query insights for a specific molecule',
            parameters: [
              {
                name: 'molecule',
                in: 'query',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        insights: { type: 'array' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/fetch-pubmed': {
          post: {
            description: 'Fetch latest articles from PubMed',
            parameters: [
              {
                name: 'molecule',
                in: 'query',
                required: true,
                schema: { type: 'string' },
              },
            ],
          },
        },
        '/analyze-trends': {
          post: {
            description: 'Analyze trends for a molecule over time',
            parameters: [
              {
                name: 'molecule',
                in: 'query',
                required: true,
                schema: { type: 'string' },
              },
              {
                name: 'days',
                in: 'query',
                required: false,
                schema: { type: 'integer', default: 30 },
              },
            },
          },
        },
      },
    }),
  },
});
```

### Step 3: Create Bedrock Agent

```typescript
// Create the agent
const agent = new bedrock.CfnAgent(this, 'Agent', {
  agentName: 'ci-alert-agent',
  agentResourceRoleArn: agentRole.roleArn,
  foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
  instruction: `You are a pharmaceutical competitive intelligence analyst. 
Your role is to:
1. Analyze drug development news and clinical trials
2. Identify competitive threats and opportunities
3. Track FDA approvals and regulatory changes
4. Provide strategic recommendations

When answering questions:
- Query the knowledge base for historical context
- Use action groups to fetch latest data
- Cross-reference multiple sources
- Provide evidence-based insights
- Highlight high-impact events`,
  knowledgeBaseIds: [knowledgeBase.attrKnowledgeBaseId],
  idleSessionTtlInSeconds: 600,
});

// Create agent alias
const agentAlias = new bedrock.CfnAgentAlias(this, 'AgentAlias', {
  agentId: agent.attrAgentId,
  agentAliasName: 'production',
});
```

### Step 4: Create Action Lambda

```python
# lambdas/bedrock-agent/action_handler.py
import json
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
insights_table = dynamodb.Table(os.environ['INSIGHTS_TABLE'])

def lambda_handler(event, context):
    """
    Handle Bedrock Agent action requests
    """
    print(f"Event: {json.dumps(event)}")
    
    # Parse agent request
    agent = event.get('agent')
    action_group = event.get('actionGroup')
    api_path = event.get('apiPath')
    parameters = event.get('parameters', [])
    
    # Convert parameters to dict
    params = {p['name']: p['value'] for p in parameters}
    
    # Route to appropriate action
    if api_path == '/query-insights':
        result = query_insights(params.get('molecule'))
    elif api_path == '/fetch-pubmed':
        result = fetch_pubmed(params.get('molecule'))
    elif api_path == '/analyze-trends':
        result = analyze_trends(
            params.get('molecule'),
            int(params.get('days', 30))
        )
    else:
        result = {'error': f'Unknown action: {api_path}'}
    
    # Return response in Bedrock Agent format
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': action_group,
            'apiPath': api_path,
            'httpMethod': 'POST',
            'httpStatusCode': 200,
            'responseBody': {
                'application/json': {
                    'body': json.dumps(result)
                }
            }
        }
    }

def query_insights(molecule):
    """Query DynamoDB for insights"""
    response = insights_table.query(
        KeyConditionExpression=Key('molecule').eq(molecule),
        ScanIndexForward=False,
        Limit=10
    )
    return {
        'insights': response.get('Items', []),
        'count': len(response.get('Items', []))
    }

def fetch_pubmed(molecule):
    """Fetch latest PubMed articles"""
    # Call PubMed API
    import requests
    url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'
    params = {
        'db': 'pubmed',
        'term': f'{molecule} AND (clinical trial OR FDA approval)',
        'retmax': 5,
        'retmode': 'json',
        'sort': 'date'
    }
    response = requests.get(url, params=params)
    data = response.json()
    
    return {
        'articles': data.get('esearchresult', {}).get('idlist', []),
        'count': len(data.get('esearchresult', {}).get('idlist', []))
    }

def analyze_trends(molecule, days):
    """Analyze sentiment trends over time"""
    start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    response = insights_table.query(
        KeyConditionExpression=Key('molecule').eq(molecule) & Key('timestamp').gt(start_date),
        ScanIndexForward=True
    )
    
    items = response.get('Items', [])
    
    # Calculate sentiment distribution
    sentiments = [item.get('sentiment', 'Neutral') for item in items]
    positive = sentiments.count('Positive')
    negative = sentiments.count('Negative')
    neutral = sentiments.count('Neutral')
    
    return {
        'molecule': molecule,
        'period_days': days,
        'total_insights': len(items),
        'sentiment_distribution': {
            'positive': positive,
            'negative': negative,
            'neutral': neutral
        },
        'trend': 'positive' if positive > negative else 'negative' if negative > positive else 'neutral'
    }
```

### Step 5: Create Agent API

```python
# lambdas/api/agent_api.py
import json
import boto3

bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

AGENT_ID = os.environ['AGENT_ID']
AGENT_ALIAS_ID = os.environ['AGENT_ALIAS_ID']

def lambda_handler(event, context):
    """
    API endpoint to interact with Bedrock Agent
    """
    body = json.loads(event.get('body', '{}'))
    query = body.get('query', '')
    session_id = body.get('sessionId', str(uuid.uuid4()))
    
    if not query:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Query is required'})
        }
    
    try:
        # Invoke Bedrock Agent
        response = bedrock_agent_runtime.invoke_agent(
            agentId=AGENT_ID,
            agentAliasId=AGENT_ALIAS_ID,
            sessionId=session_id,
            inputText=query
        )
        
        # Stream response
        completion = ''
        for event in response['completion']:
            if 'chunk' in event:
                chunk = event['chunk']
                completion += chunk.get('bytes', b'').decode('utf-8')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'response': completion,
                'sessionId': session_id
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
```

---

## Use Cases with Bedrock Agent

### Use Case 1: Complex Query

**User:** "What are the latest developments for Keytruda and how do they compare to Opdivo?"

**Agent Workflow:**
1. Query knowledge base for Keytruda history
2. Call `/query-insights` for latest Keytruda data
3. Call `/fetch-pubmed` for recent articles
4. Query knowledge base for Opdivo history
5. Call `/query-insights` for latest Opdivo data
6. Synthesize comparison
7. Generate strategic recommendations

**Response:**
```
Based on my analysis:

Keytruda Recent Developments:
- FDA approved for first-line melanoma (Jan 2024)
- Phase III trial showed 45% survival improvement
- Market analysts project $5B annual sales

Opdivo Recent Developments:
- Phase III trial in lung cancer ongoing
- Combination therapy with Yervoy showing promise
- Patent expiration in 2028

Competitive Analysis:
- Keytruda has first-mover advantage in melanoma
- Opdivo focusing on combination strategies
- Both targeting similar patient populations

Strategic Recommendations:
1. Monitor Opdivo combination trial results
2. Consider accelerating competing programs
3. Evaluate partnership opportunities
```

### Use Case 2: Trend Analysis

**User:** "Analyze sentiment trends for Humira over the past 90 days"

**Agent Workflow:**
1. Call `/analyze-trends` with molecule=Humira, days=90
2. Query knowledge base for context
3. Identify key events
4. Generate trend visualization data
5. Provide strategic insights

### Use Case 3: Multi-Source Research

**User:** "Create an executive summary of all FDA approvals this month"

**Agent Workflow:**
1. Query knowledge base for FDA approval history
2. Call `/query-insights` filtered by source=FDA
3. Call `/fetch-pubmed` for FDA announcements
4. Synthesize information
5. Generate executive summary with key takeaways

---

## Cost Analysis

### Without Bedrock Agent (Current)
```
Claude 3 Sonnet:
- 100 insights/day × 500 input tokens = 50K tokens/day
- 100 insights/day × 200 output tokens = 20K tokens/day
- Monthly: 1.5M input + 600K output
- Cost: $4.50 input + $9.00 output = $13.50/month
```

### With Bedrock Agent
```
Agent Invocations:
- 50 queries/day × 30 days = 1,500 queries/month
- Average 3 actions per query = 4,500 actions
- Input: 1,500 queries × 1,000 tokens = 1.5M tokens
- Output: 1,500 responses × 500 tokens = 750K tokens
- Actions: 4,500 × 200 tokens = 900K tokens

Knowledge Base:
- OpenSearch Serverless: $0.24/OCU-hour
- 2 OCUs × 730 hours = $350/month

Total: ~$375/month
```

### Break-Even Analysis

Bedrock Agent is cost-effective when:
- Need complex multi-step workflows
- Interactive conversational queries
- Cross-referencing multiple sources
- Building institutional knowledge
- User-facing chat interface

**For this project:** Agent is overkill for simple batch processing, but valuable for interactive analysis.

---

## Recommendation

### Phase 1 (Current): ❌ Don't Use Agent Yet

**Reasons:**
1. Simple single-step processing sufficient
2. No interactive queries needed
3. High cost ($375/month vs $13.50/month)
4. Batch processing works well
5. No chat interface

### Phase 2 (Future): ✅ Add Agent When:

1. **Interactive Dashboard**
   - Users ask natural language questions
   - Need conversational interface
   - Multi-turn conversations

2. **Complex Analysis**
   - Cross-reference multiple sources
   - Multi-step research workflows
   - Strategic recommendations

3. **Knowledge Management**
   - Build institutional knowledge
   - Query historical analyses
   - RAG for past insights

4. **Budget Allows**
   - $375/month for advanced features
   - ROI justifies cost
   - User demand exists

---

## Hybrid Approach (Recommended)

### Keep Current Simple Processing
```python
# For batch processing (current)
EventBridge → Lambda → Bedrock Claude → DynamoDB
```

### Add Agent for Interactive Queries
```python
# For user queries (future)
User → API Gateway → Lambda → Bedrock Agent → Response
```

**Benefits:**
- Cost-effective batch processing
- Advanced interactive capabilities
- Best of both worlds
- Gradual migration path

---

## Summary

| Feature | Current (Claude) | With Agent |
|---------|-----------------|------------|
| Cost | $13.50/month | $375/month |
| Complexity | Simple | Complex |
| Use Case | Batch processing | Interactive queries |
| Multi-step | No | Yes |
| Knowledge Base | No | Yes |
| Conversation | No | Yes |
| **Recommendation** | ✅ Use now | ⏳ Add later |

**Conclusion:** Start with simple Claude integration, add Bedrock Agent when you need interactive conversational capabilities and budget allows.
