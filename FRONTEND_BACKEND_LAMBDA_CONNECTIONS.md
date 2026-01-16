# Frontend ↔ Backend ↔ Lambda Connection Map

## Complete Connection Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    FRONTEND     │    │     BACKEND     │    │     LAMBDA      │
│   (React App)   │◄──►│  (API Gateway)  │◄──►│   (Functions)   │
│                 │    │                 │    │                 │
│ • ECS Fargate   │    │ • REST API      │    │ • ARM64 Python  │
│ • Port 8080     │    │ • Cognito Auth  │    │ • Event Driven  │
│ • Material-UI   │    │ • JWT Tokens    │    │ • Serverless    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 1. FRONTEND → BACKEND Connections

### **React App (ECS) → API Gateway**

#### **Connection Details:**
- **Protocol:** HTTPS
- **Port:** 443
- **Authentication:** JWT Bearer Token
- **Content-Type:** application/json
- **CORS:** Enabled for frontend domain

#### **API Endpoints Called by Frontend:**

```javascript
// Frontend API Calls (React)

// 1. Authentication
POST /auth/login
Headers: { "Content-Type": "application/json" }
Body: { "username": "user@email.com", "password": "password" }
Response: { "AccessToken": "jwt-token", "IdToken": "id-token" }

// 2. Get Insights
GET /insights?molecule=pembrolizumab&limit=50
Headers: { "Authorization": "Bearer jwt-token" }
Response: { "insights": [...], "count": 25 }

// 3. Watchlist Operations
GET /watchlist?userId=user123
Headers: { "Authorization": "Bearer jwt-token" }
Response: { "molecules": ["pembrolizumab", "nivolumab"] }

POST /watchlist
Headers: { "Authorization": "Bearer jwt-token" }
Body: { "userId": "user123", "molecule": "atezolizumab" }
Response: { "success": true }

DELETE /watchlist?userId=user123&molecule=pembrolizumab
Headers: { "Authorization": "Bearer jwt-token" }
Response: { "success": true }

// 4. User Settings
GET /settings?userId=user123
Headers: { "Authorization": "Bearer jwt-token" }
Response: { "email": "user@email.com", "digestEnabled": true }

PUT /settings
Headers: { "Authorization": "Bearer jwt-token" }
Body: { "userId": "user123", "digestEnabled": false }
Response: { "success": true }

// 5. AI Agent Chat
POST /agent
Headers: { "Authorization": "Bearer jwt-token" }
Body: { "message": "What's the latest on Keytruda?", "sessionId": "session123" }
Response: { "response": "Based on recent data...", "sources": [...] }

// 6. AgentCore Multi-Agent
POST /agentcore/query
Headers: { "Authorization": "Bearer jwt-token" }
Body: { "query": "Analyze competitive landscape", "workflow_type": "comprehensive" }
Response: { "response": "...", "agents_used": [...], "individual_results": {...} }
```

#### **Frontend Connection Code:**
```javascript
// React API Client
class APIClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL;
    this.token = localStorage.getItem('accessToken');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, config);
    return response.json();
  }

  // Insights API
  async getInsights(molecule, limit = 50) {
    return this.request(`/insights?molecule=${molecule}&limit=${limit}`);
  }

  // Watchlist API
  async getWatchlist(userId) {
    return this.request(`/watchlist?userId=${userId}`);
  }

  async addToWatchlist(userId, molecule) {
    return this.request('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ userId, molecule })
    });
  }

  // Agent Chat API
  async chatWithAgent(message, sessionId) {
    return this.request('/agent', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId })
    });
  }
}
```

---

## 2. BACKEND → LAMBDA Connections

### **API Gateway → Lambda Functions**

#### **Connection Details:**
- **Protocol:** AWS Event (Internal)
- **Authentication:** IAM Roles
- **Timeout:** 30 seconds (API), 120 seconds (Processing)
- **Memory:** 512MB (API), 1024MB (Processing)
- **Runtime:** Python 3.12 ARM64

#### **Lambda Function Mapping:**

```yaml
API Endpoints → Lambda Functions:

GET /insights → InsightsFunction
  - File: lambdas/api/insights_api.py
  - Memory: 512MB
  - Timeout: 30s
  - Connects to: DynamoDB InsightsTable

GET /watchlist → WatchlistFunction  
  - File: lambdas/api/watchlist_api.py
  - Memory: 512MB
  - Timeout: 30s
  - Connects to: DynamoDB WatchlistTable

POST /watchlist → WatchlistFunction
  - Same function, different method
  - Connects to: DynamoDB WatchlistTable

DELETE /watchlist → WatchlistFunction
  - Same function, different method
  - Connects to: DynamoDB WatchlistTable

GET /settings → UserSettingsFunction
  - File: lambdas/api/user_settings_api.py
  - Memory: 512MB
  - Timeout: 30s
  - Connects to: DynamoDB UserSettingsTable

PUT /settings → UserSettingsFunction
  - Same function, different method
  - Connects to: DynamoDB UserSettingsTable

POST /agent → AgentFunction
  - File: lambdas/api/agent_api.py
  - Memory: 1024MB
  - Timeout: 60s
  - Connects to: Bedrock Agent, Knowledge Base

POST /agentcore/query → AgentCoreFunction
  - File: lambdas/agentcore/orchestrator.py
  - Memory: 1024MB
  - Timeout: 120s
  - Connects to: Multiple Bedrock Agents, Step Functions
```

#### **Backend Connection Code:**
```python
# API Gateway Lambda Integration
import json
import boto3
from decimal import Decimal

def lambda_handler(event, context):
    """
    API Gateway → Lambda Event Structure
    """
    # Extract request details
    http_method = event['httpMethod']
    path = event['path']
    query_params = event.get('queryStringParameters', {})
    headers = event.get('headers', {})
    body = event.get('body')
    
    # JWT token from Cognito (already validated by API Gateway)
    user_context = event['requestContext']['authorizer']['claims']
    user_id = user_context['sub']
    
    # Parse request body
    if body:
        request_data = json.loads(body)
    
    # Route to appropriate handler
    if path == '/insights' and http_method == 'GET':
        return handle_get_insights(query_params, user_id)
    elif path == '/watchlist' and http_method == 'GET':
        return handle_get_watchlist(query_params, user_id)
    elif path == '/watchlist' and http_method == 'POST':
        return handle_add_watchlist(request_data, user_id)
    # ... more routes
    
def handle_get_insights(params, user_id):
    """
    Lambda → DynamoDB Connection
    """
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('InsightsTable')
    
    molecule = params.get('molecule')
    limit = int(params.get('limit', 50))
    
    if molecule:
        # Query by molecule (PK)
        response = table.query(
            KeyConditionExpression='molecule = :molecule',
            ExpressionAttributeValues={':molecule': molecule},
            Limit=limit,
            ScanIndexForward=False  # Latest first
        )
    else:
        # Scan all insights
        response = table.scan(Limit=limit)
    
    # Convert Decimal to float for JSON serialization
    items = convert_decimals(response['Items'])
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'insights': items,
            'count': len(items)
        })
    }
```

---

## 3. LAMBDA → BACKEND → FRONTEND Flow

### **Complete Request-Response Cycle:**

```
1. User clicks "Get Insights" button in React
    ↓
2. React calls APIClient.getInsights()
    ↓ HTTPS POST
3. API Gateway receives request
    ↓ JWT Validation
4. Cognito validates JWT token
    ↓ Authorized Event
5. API Gateway invokes InsightsFunction Lambda
    ↓ AWS Event
6. Lambda queries DynamoDB InsightsTable
    ↓ HTTPS API
7. DynamoDB returns insight records
    ↓ JSON Response
8. Lambda processes and formats data
    ↓ Return Value
9. API Gateway receives Lambda response
    ↓ HTTP Response
10. React receives JSON data
    ↓ State Update
11. UI renders insights in table
```

### **Timing Breakdown:**
- **Frontend → API Gateway:** 50-100ms
- **API Gateway → Cognito:** 20-50ms
- **API Gateway → Lambda:** 5-10ms
- **Lambda → DynamoDB:** 10-50ms
- **Lambda Processing:** 10-30ms
- **Response Path:** 20-50ms
- **Total:** 115-290ms (p50: 150ms)

---

## 4. Event-Driven Lambda Connections

### **Scheduled Lambda Functions:**

```
EventBridge Scheduler → Lambda Functions:

Midnight UTC (Cron: 0 0 * * ? *):
├─ PubMedFunction (17:30 UTC)
│  └─ Connects to: PubMed API → SQS Queue
├─ ClinicalTrialsFunction (17:35 UTC)  
│  └─ Connects to: ClinicalTrials.gov API → SQS Queue
└─ FDAFunction (17:40 UTC)
   └─ Connects to: FDA API → SQS Queue

SQS Queue → ProcessorFunction:
└─ Batch Processing (10 messages)
   └─ Connects to: Bedrock Claude 3.5 Haiku → DynamoDB + S3

9 AM UTC (Cron: 0 9 * * ? *):
└─ DigestFunction
   └─ Connects to: DynamoDB → Bedrock → SES
```

### **SQS → Lambda Connection:**
```python
# SQS Event → Lambda
def lambda_handler(event, context):
    """
    SQS → Lambda Event Structure
    """
    for record in event['Records']:
        # Extract message from SQS
        message_body = json.loads(record['body'])
        
        # Process document
        process_document(message_body)
        
        # Message automatically deleted from SQS on success

def process_document(document_data):
    """
    Lambda → Bedrock → DynamoDB Connection
    """
    # Call Bedrock for AI analysis
    bedrock = boto3.client('bedrock-runtime')
    response = bedrock.invoke_model(
        modelId='anthropic.claude-3-5-haiku-20241022',
        body=json.dumps({
            'anthropic_version': 'bedrock-2023-05-31',
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 1000
        })
    )
    
    # Parse AI response
    ai_result = json.loads(response['body'].read())
    
    # Store in DynamoDB
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('InsightsTable')
    table.put_item(Item={
        'molecule': document_data['molecule'],
        'timestamp': datetime.now().isoformat(),
        'insight': ai_result['content'][0]['text'],
        'source': document_data['source']
    })
```

---

## 5. Lambda Internal Connections

### **Lambda → AWS Services:**

```python
# Lambda Function Internal Connections

import boto3
import json
from datetime import datetime

class LambdaConnections:
    def __init__(self):
        # Initialize AWS service clients
        self.dynamodb = boto3.resource('dynamodb')
        self.s3 = boto3.client('s3')
        self.bedrock = boto3.client('bedrock-runtime')
        self.ses = boto3.client('ses')
        self.sqs = boto3.client('sqs')
        
    def connect_to_dynamodb(self, table_name):
        """Lambda → DynamoDB Connection"""
        table = self.dynamodb.Table(table_name)
        return table
        
    def connect_to_bedrock(self, model_id):
        """Lambda → Bedrock Connection"""
        return self.bedrock.invoke_model(
            modelId=model_id,
            body=json.dumps(payload)
        )
        
    def connect_to_s3(self, bucket, key):
        """Lambda → S3 Connection"""
        return self.s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=data
        )
        
    def connect_to_ses(self, to_email, subject, body):
        """Lambda → SES Connection"""
        return self.ses.send_email(
            Source='noreply@yourcompany.com',
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject},
                'Body': {'Html': {'Data': body}}
            }
        )
```

### **Lambda → Lambda Communication:**
```python
# AgentCore Orchestrator → Individual Agents
def orchestrate_multi_agent_query(query):
    """
    AgentCore Lambda → Multiple Agent Lambdas
    """
    lambda_client = boto3.client('lambda')
    
    # Route to appropriate agents
    agents = determine_agents(query)  # ['competitive', 'regulatory', 'financial']
    
    results = {}
    for agent_name in agents:
        # Invoke specific agent Lambda
        response = lambda_client.invoke(
            FunctionName=f'CIAlert-{agent_name}-Agent',
            InvocationType='RequestResponse',  # Synchronous
            Payload=json.dumps({
                'query': query,
                'agent_type': agent_name
            })
        )
        
        # Parse response
        result = json.loads(response['Payload'].read())
        results[agent_name] = result
    
    # Synthesize results
    final_response = synthesize_agent_results(results)
    return final_response
```

---

## 6. Connection Error Handling

### **Frontend Error Handling:**
```javascript
// React Error Handling
class APIClient {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, redirect to login
          this.handleAuthError();
          throw new Error('Authentication required');
        } else if (response.status === 429) {
          // Rate limited
          throw new Error('Too many requests, please try again later');
        } else if (response.status >= 500) {
          // Server error
          throw new Error('Server error, please try again');
        }
      }
      
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
}
```

### **Lambda Error Handling:**
```python
# Lambda Error Handling
def lambda_handler(event, context):
    try:
        # Process request
        result = process_request(event)
        
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
        
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    except AuthenticationError as e:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Unauthorized'})
        }
    except Exception as e:
        # Log error for debugging
        print(f"Lambda Error: {str(e)}")
        
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
```

---

## 7. Connection Monitoring

### **CloudWatch Metrics:**
```python
# Lambda Connection Monitoring
import boto3
cloudwatch = boto3.client('cloudwatch')

def put_custom_metric(metric_name, value, unit='Count'):
    """Monitor Lambda connections"""
    cloudwatch.put_metric_data(
        Namespace='CIAlert/Lambda',
        MetricData=[{
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit,
            'Timestamp': datetime.utcnow()
        }]
    )

# Usage in Lambda functions
put_custom_metric('DynamoDBConnections', 1)
put_custom_metric('BedrockLatency', response_time, 'Milliseconds')
put_custom_metric('APIGatewayRequests', 1)
```

### **Connection Health Checks:**
```javascript
// Frontend Health Check
async checkSystemHealth() {
  const healthChecks = [
    { name: 'API Gateway', endpoint: '/health' },
    { name: 'Insights API', endpoint: '/insights?limit=1' },
    { name: 'Agent API', endpoint: '/agent', method: 'POST', 
      body: { message: 'health check', sessionId: 'health' } }
  ];
  
  const results = await Promise.allSettled(
    healthChecks.map(check => this.request(check.endpoint, {
      method: check.method || 'GET',
      body: check.body ? JSON.stringify(check.body) : undefined
    }))
  );
  
  return results.map((result, index) => ({
    service: healthChecks[index].name,
    status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    latency: result.latency
  }));
}
```

---

## Connection Summary

### **Frontend ↔ Backend ↔ Lambda Flow:**

1. **Frontend (React)** makes HTTPS API calls to **Backend (API Gateway)**
2. **Backend (API Gateway)** validates JWT with **Cognito** and invokes **Lambda Functions**
3. **Lambda Functions** connect to **AWS Services** (DynamoDB, Bedrock, S3, SES)
4. **Lambda Functions** return responses to **Backend (API Gateway)**
5. **Backend (API Gateway)** returns JSON responses to **Frontend (React)**
6. **Frontend (React)** updates UI with received data

### **Key Connection Points:**
- **Frontend → Backend:** HTTPS REST API calls with JWT authentication
- **Backend → Lambda:** AWS Event-driven invocations with IAM roles
- **Lambda → Services:** HTTPS API calls to AWS services with IAM permissions
- **Lambda → Lambda:** Direct invocation for multi-agent orchestration
- **EventBridge → Lambda:** Scheduled triggers for automated processing
- **SQS → Lambda:** Event-driven batch processing

**All connections are secured with TLS encryption and IAM role-based authentication.**