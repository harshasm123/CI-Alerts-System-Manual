# DynamoDB DAX Implementation Guide

## What is DAX?

DynamoDB Accelerator (DAX) is a fully managed, in-memory cache for DynamoDB that delivers up to 10x performance improvement - from milliseconds to microseconds.

---

## Should You Use DAX in This Project?

### ✅ YES - Use DAX If:

1. **High Read Traffic**
   - API receives 1000+ requests/minute
   - Same insights queried repeatedly
   - Dashboard refreshes frequently

2. **Read-Heavy Workload**
   - 80%+ reads vs writes
   - Users frequently check same molecules
   - Real-time dashboard updates

3. **Latency Requirements**
   - Need sub-millisecond response times
   - User-facing API with strict SLAs
   - Mobile app with poor connectivity

4. **Cost Justification**
   - DynamoDB read costs > $50/month
   - Can reduce read capacity units by 80%+
   - Improved user experience worth the cost

### ❌ NO - Skip DAX If:

1. **Low Traffic**
   - < 100 requests/minute
   - Current DynamoDB costs < $10/month
   - Mostly write operations

2. **Budget Constraints**
   - DAX costs $0.04/hour (~$30/month minimum)
   - Current system meets performance needs
   - Cost > benefit for small workload

3. **Write-Heavy Workload**
   - More writes than reads
   - Data changes frequently
   - Cache invalidation overhead

---

## Current Project Analysis

### Current Architecture (Without DAX)

```
API Gateway → Lambda → DynamoDB
                ↓
         5-10ms latency
```

### With DAX

```
API Gateway → Lambda → DAX → DynamoDB
                ↓
         1-2ms latency (cache hit)
         5-10ms latency (cache miss)
```

### Performance Comparison

| Metric | Without DAX | With DAX |
|--------|-------------|----------|
| Read Latency (p50) | 5-10ms | 1-2ms |
| Read Latency (p99) | 20-30ms | 3-5ms |
| Throughput | 3,000 RPS | 10,000+ RPS |
| Cost (100K reads/day) | $15/month | $35/month ($30 DAX + $5 DynamoDB) |

### Recommendation for This Project

**Start WITHOUT DAX, add later if needed:**

✅ Current traffic is low (< 100 requests/minute)  
✅ DynamoDB on-demand handles load well  
✅ 5-10ms latency is acceptable  
✅ Cost optimization is priority  

**Add DAX when:**
- Traffic exceeds 1000 requests/minute
- DynamoDB costs > $50/month
- Users complain about slow dashboard
- Need sub-millisecond latency

---

## Implementation Guide

### Step 1: Add DAX to CDK Stack

```typescript
// infrastructure/lib/ci-alert-stack.ts
import * as dax from 'aws-cdk-lib/aws-dax';

export class CIAlertStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Existing DynamoDB table
    const insightsTable = new dynamodb.Table(this, 'InsightsTable', {
      partitionKey: { name: 'molecule', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // DAX Subnet Group (requires VPC)
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 0, // Use VPC endpoints instead
    });

    const daxSubnetGroup = new dax.CfnSubnetGroup(this, 'DAXSubnetGroup', {
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      description: 'DAX Subnet Group',
    });

    // DAX Security Group
    const daxSecurityGroup = new ec2.SecurityGroup(this, 'DAXSecurityGroup', {
      vpc,
      description: 'Security group for DAX cluster',
      allowAllOutbound: true,
    });

    daxSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(8111),
      'Allow DAX access from VPC'
    );

    // DAX IAM Role
    const daxRole = new iam.Role(this, 'DAXRole', {
      assumedBy: new iam.ServicePrincipal('dax.amazonaws.com'),
    });

    insightsTable.grantReadData(daxRole);

    // DAX Cluster
    const daxCluster = new dax.CfnCluster(this, 'DAXCluster', {
      iamRoleArn: daxRole.roleArn,
      nodeType: 'dax.t3.small', // Smallest instance
      replicationFactor: 1, // Single node for dev, 3 for prod
      subnetGroupName: daxSubnetGroup.ref,
      securityGroupIds: [daxSecurityGroup.securityGroupId],
      clusterName: 'ci-alert-dax',
      description: 'DAX cluster for CI Alert System',
    });

    // Output DAX endpoint
    new cdk.CfnOutput(this, 'DAXEndpoint', {
      value: daxCluster.attrClusterDiscoveryEndpoint,
      description: 'DAX Cluster Endpoint',
    });

    // Update Lambda to use VPC
    const insightsFunction = new lambda.Function(this, 'InsightsFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'insights_api.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/api'),
      vpc, // Add Lambda to VPC
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [daxSecurityGroup],
      environment: {
        INSIGHTS_TABLE: insightsTable.tableName,
        DAX_ENDPOINT: daxCluster.attrClusterDiscoveryEndpoint,
        USE_DAX: 'true',
      },
    });
  }
}
```

### Step 2: Update Lambda Code to Use DAX

```python
# lambdas/api/insights_api.py
import json
import os
import boto3
from boto3.dynamodb.conditions import Key
from amazondax import AmazonDaxClient

# Check if DAX is enabled
USE_DAX = os.environ.get('USE_DAX', 'false').lower() == 'true'
DAX_ENDPOINT = os.environ.get('DAX_ENDPOINT')
INSIGHTS_TABLE = os.environ['INSIGHTS_TABLE']

# Initialize DynamoDB client
if USE_DAX and DAX_ENDPOINT:
    # Use DAX client
    dax_client = AmazonDaxClient(endpoint_url=DAX_ENDPOINT)
    dynamodb = boto3.resource('dynamodb', endpoint_url=DAX_ENDPOINT)
    print(f"Using DAX endpoint: {DAX_ENDPOINT}")
else:
    # Use regular DynamoDB
    dynamodb = boto3.resource('dynamodb')
    print("Using DynamoDB directly (no DAX)")

table = dynamodb.Table(INSIGHTS_TABLE)

def lambda_handler(event, context):
    params = event.get('queryStringParameters', {}) or {}
    molecule = params.get('molecule')
    limit = int(params.get('limit', 10))
    
    try:
        if molecule:
            # Query with DAX caching
            response = table.query(
                KeyConditionExpression=Key('molecule').eq(molecule),
                ScanIndexForward=False,
                Limit=limit
            )
        else:
            # Scan with DAX caching
            response = table.scan(Limit=limit)
        
        items = response.get('Items', [])
        
        # Format items
        formatted_items = []
        for item in items:
            formatted_items.append({
                'molecule': item.get('molecule', ''),
                'timestamp': item.get('timestamp', ''),
                'summary': item.get('insights', item.get('raw_content', ''))[:500],
                'source': item.get('source', 'Unknown')
            })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Cache': 'DAX' if USE_DAX else 'DynamoDB'
            },
            'body': json.dumps({
                'insights': formatted_items,
                'count': len(formatted_items),
                'cached': USE_DAX
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
```

### Step 3: Update Lambda Dependencies

```python
# lambdas/requirements.txt
boto3>=1.26.0
amazon-dax-client>=2.0.0
```

### Step 4: Deploy with DAX

```bash
# Install DAX client locally for testing
pip install amazon-dax-client

# Deploy infrastructure
cd infrastructure
npm run build
cdk deploy CIAlertStack

# Get DAX endpoint
DAX_ENDPOINT=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`DAXEndpoint`].OutputValue' --output text)
echo "DAX Endpoint: $DAX_ENDPOINT"

# Test API with DAX
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
curl "${API_URL}insights" -H "Authorization: JWT_TOKEN"
```

---

## Cost Analysis

### Without DAX (Current)
```
DynamoDB On-Demand:
- 100,000 reads/day = 3M reads/month
- $0.25 per million reads = $0.75/month
- 10,000 writes/day = 300K writes/month
- $1.25 per million writes = $0.38/month
Total: ~$1.13/month
```

### With DAX
```
DAX Cluster:
- dax.t3.small (1 node) = $0.04/hour
- 730 hours/month = $29.20/month

DynamoDB (reduced reads):
- 20,000 reads/day (80% cache hit) = 600K reads/month
- $0.25 per million reads = $0.15/month
- 10,000 writes/day = 300K writes/month
- $1.25 per million writes = $0.38/month

Total: ~$29.73/month
```

### Break-Even Analysis

DAX becomes cost-effective when:
- DynamoDB read costs > $30/month
- That's ~120 million reads/month
- Or ~4 million reads/day
- Or ~2,800 reads/minute

**Conclusion:** For this project's current scale (< 100 reads/minute), DAX is NOT cost-effective.

---

## When to Add DAX

### Monitoring Triggers

Add DAX when you see:

1. **High Read Costs**
```bash
# Check DynamoDB costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://filter.json

# filter.json
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["Amazon DynamoDB"]
  }
}
```

2. **High Latency**
```bash
# Check API Gateway latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value="CI Alert API" \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average,Maximum
```

3. **High Read Throughput**
```bash
# Check DynamoDB read capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=InsightsTable \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

---

## Alternative: Application-Level Caching

### Option 1: ElastiCache Redis (Cheaper than DAX)

```typescript
// Add Redis cluster
const redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
  cacheNodeType: 'cache.t3.micro',
  engine: 'redis',
  numCacheNodes: 1,
  vpcSecurityGroupIds: [securityGroup.securityGroupId],
});

// Cost: ~$12/month (vs $30/month for DAX)
```

```python
# Lambda with Redis caching
import redis
import json

redis_client = redis.Redis(host=REDIS_ENDPOINT, port=6379, decode_responses=True)

def lambda_handler(event, context):
    molecule = event['queryStringParameters'].get('molecule')
    cache_key = f"insights:{molecule}"
    
    # Try cache first
    cached = redis_client.get(cache_key)
    if cached:
        return {
            'statusCode': 200,
            'body': cached,
            'headers': {'X-Cache': 'HIT'}
        }
    
    # Cache miss - query DynamoDB
    response = table.query(...)
    
    # Cache for 5 minutes
    redis_client.setex(cache_key, 300, json.dumps(response))
    
    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': {'X-Cache': 'MISS'}
    }
```

### Option 2: Lambda Layer Caching (Free)

```python
# In-memory caching within Lambda
from functools import lru_cache
import time

@lru_cache(maxsize=100)
def get_insights_cached(molecule, ttl_hash):
    # ttl_hash changes every 5 minutes, invalidating cache
    response = table.query(
        KeyConditionExpression=Key('molecule').eq(molecule)
    )
    return response['Items']

def lambda_handler(event, context):
    molecule = event['queryStringParameters'].get('molecule')
    
    # Cache for 5 minutes
    ttl_hash = int(time.time() / 300)
    
    items = get_insights_cached(molecule, ttl_hash)
    
    return {
        'statusCode': 200,
        'body': json.dumps({'insights': items})
    }
```

---

## Recommendation

### For Current Project: ❌ Don't Use DAX Yet

**Reasons:**
1. Traffic is low (< 100 requests/minute)
2. DynamoDB costs are minimal ($1-5/month)
3. Current latency is acceptable (5-10ms)
4. DAX adds $30/month minimum cost
5. Adds complexity (VPC, security groups)

### Use Instead:
1. **Lambda in-memory caching** (free, simple)
2. **CloudFront caching** for API responses (already have)
3. **DynamoDB on-demand** (current setup)

### Add DAX When:
1. Traffic > 1000 requests/minute
2. DynamoDB costs > $50/month
3. Need sub-millisecond latency
4. Budget allows $30+/month for caching

---

## Summary

| Scenario | Solution | Cost | Latency |
|----------|----------|------|---------|
| Current (< 100 req/min) | DynamoDB On-Demand | $1-5/month | 5-10ms |
| Medium (100-1000 req/min) | Lambda Caching | $1-5/month | 2-5ms |
| High (1000+ req/min) | ElastiCache Redis | $12/month | 1-2ms |
| Very High (5000+ req/min) | DAX | $30/month | < 1ms |

**Current Recommendation:** Stick with DynamoDB On-Demand + Lambda caching. Add DAX only when traffic justifies the cost.
