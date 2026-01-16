# CI Alert System - Detailed Logs & Metrics Guide

## 📊 Comprehensive Monitoring & Observability

---

## 1. CloudWatch Logs

### Lambda Function Logs

#### **PubMed Ingestion Function**
```bash
# View real-time logs
aws logs tail /aws/lambda/CIAlertStack-PubMedFunction --follow --region us-west-2

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/CIAlertStack-PubMedFunction \
  --filter-pattern "ERROR" \
  --region us-west-2

# Get last 100 log entries
aws logs tail /aws/lambda/CIAlertStack-PubMedFunction --since 1h --region us-west-2
```

**Key Metrics to Monitor:**
- Ingestion success rate
- PubMed API response time
- Number of articles fetched
- Failed molecule queries

**Sample Log Output:**
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "Fetching PubMed data for molecule: Keytruda",
  "molecule": "Keytruda",
  "articles_found": 47,
  "api_latency_ms": 234,
  "request_id": "abc-123-def"
}
```

---

#### **Processor Function (AI Analysis)**
```bash
# Monitor AI processing
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --follow --region us-west-2

# Check for AI errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/CIAlertStack-ProcessorFunction \
  --filter-pattern "ModelTimeout OR ThrottlingException" \
  --region us-west-2
```

**Key Metrics:**
- AI model latency (Claude 3.5 Haiku)
- Token usage per request
- Processing success rate
- Queue processing time

**Sample Log Output:**
```json
{
  "timestamp": "2024-01-15T10:31:12.456Z",
  "level": "INFO",
  "message": "AI processing completed",
  "molecule": "Keytruda",
  "model": "claude-3-5-haiku-20241022",
  "input_tokens": 1234,
  "output_tokens": 456,
  "latency_ms": 1850,
  "cost_usd": 0.0023,
  "confidence_score": 0.92
}
```

---

#### **Digest Function (Email Summaries)**
```bash
# Monitor daily digest generation
aws logs tail /aws/lambda/CIAlertStack-DigestFunction --follow --region us-west-2

# Check email delivery status
aws logs filter-log-events \
  --log-group-name /aws/lambda/CIAlertStack-DigestFunction \
  --filter-pattern "Email sent successfully" \
  --region us-west-2
```

**Key Metrics:**
- Digest generation time
- Number of insights included
- Email delivery success rate
- User engagement (opens/clicks)

---

#### **Bedrock Agent Function**
```bash
# Monitor RAG queries
aws logs tail /aws/lambda/CIAlertStack-AgentFunction --follow --region us-west-2

# Check knowledge base retrieval
aws logs filter-log-events \
  --log-group-name /aws/lambda/CIAlertStack-AgentFunction \
  --filter-pattern "Knowledge base search" \
  --region us-west-2
```

**Key Metrics:**
- Query response time
- Knowledge base hit rate
- Agent invocation count
- Citation accuracy

---

### API Gateway Logs

```bash
# Enable execution logs
aws apigatewayv2 update-stage \
  --api-id YOUR_API_ID \
  --stage-name prod \
  --access-log-settings '{"DestinationArn":"arn:aws:logs:us-west-2:ACCOUNT:log-group:/aws/apigateway/CIAlert","Format":"$context.requestId $context.error.message $context.error.messageString"}' \
  --region us-west-2

# View API logs
aws logs tail /aws/apigateway/CIAlert --follow --region us-west-2
```

**Key Metrics:**
- Request count per endpoint
- 4xx/5xx error rates
- Average latency
- Authentication failures

**Sample Log Output:**
```json
{
  "requestId": "abc-123-def",
  "ip": "203.0.113.42",
  "requestTime": "15/Jan/2024:10:30:45 +0000",
  "httpMethod": "GET",
  "routeKey": "GET /insights",
  "status": 200,
  "protocol": "HTTP/1.1",
  "responseLength": 4567,
  "integrationLatency": 234,
  "responseLatency": 245
}
```

---

## 2. CloudWatch Metrics

### Custom Application Metrics

#### **Publish Custom Metrics**
```python
# In Lambda function
import boto3
from datetime import datetime

cloudwatch = boto3.client('cloudwatch')

def publish_metric(metric_name, value, unit='Count'):
    cloudwatch.put_metric_data(
        Namespace='CIAlert/Application',
        MetricData=[
            {
                'MetricName': metric_name,
                'Value': value,
                'Unit': unit,
                'Timestamp': datetime.utcnow(),
                'Dimensions': [
                    {'Name': 'Environment', 'Value': 'Production'},
                    {'Name': 'Service', 'Value': 'Ingestion'}
                ]
            }
        ]
    )

# Usage
publish_metric('ArticlesProcessed', 47, 'Count')
publish_metric('ProcessingLatency', 1850, 'Milliseconds')
publish_metric('AIModelCost', 0.0023, 'None')
```

---

#### **Query Metrics**
```bash
# Get ingestion metrics (last 24 hours)
aws cloudwatch get-metric-statistics \
  --namespace CIAlert/Application \
  --metric-name ArticlesProcessed \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum Average \
  --region us-west-2

# Get AI processing latency
aws cloudwatch get-metric-statistics \
  --namespace CIAlert/ML \
  --metric-name ModelLatency \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average Maximum \
  --region us-west-2
```

---

### Standard AWS Metrics

#### **Lambda Metrics**
```bash
# Invocation count
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=CIAlertStack-ProcessorFunction \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-west-2

# Error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=CIAlertStack-ProcessorFunction \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-west-2

# Duration (latency)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=CIAlertStack-ProcessorFunction \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average Maximum \
  --region us-west-2
```

---

#### **DynamoDB Metrics**
```bash
# Read capacity usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=CIAlertStack-InsightsTable \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum Average \
  --region us-west-2

# Write capacity usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=CIAlertStack-InsightsTable \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum Average \
  --region us-west-2

# Throttled requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=CIAlertStack-InsightsTable \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-west-2
```

---

#### **API Gateway Metrics**
```bash
# Request count
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiId,Value=YOUR_API_ID \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-west-2

# 4xx errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 4XXError \
  --dimensions Name=ApiId,Value=YOUR_API_ID \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-west-2

# Latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiId,Value=YOUR_API_ID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average Maximum p99 \
  --region us-west-2
```

---

## 3. CloudWatch Dashboards

### Create Comprehensive Dashboard

```bash
# Create dashboard JSON
cat > dashboard.json << 'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Total Invocations"}],
          [".", "Errors", {"stat": "Sum", "label": "Errors"}],
          [".", "Throttles", {"stat": "Sum", "label": "Throttles"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-west-2",
        "title": "Lambda Performance",
        "yAxis": {"left": {"min": 0}}
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Duration", {"stat": "Average", "label": "Avg Duration"}],
          ["...", {"stat": "Maximum", "label": "Max Duration"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-west-2",
        "title": "Lambda Latency (ms)",
        "yAxis": {"left": {"min": 0}}
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", {"stat": "Sum"}],
          [".", "ConsumedWriteCapacityUnits", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-west-2",
        "title": "DynamoDB Capacity Usage"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGateway", "Count", {"stat": "Sum", "label": "Requests"}],
          [".", "4XXError", {"stat": "Sum", "label": "4xx Errors"}],
          [".", "5XXError", {"stat": "Sum", "label": "5xx Errors"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-west-2",
        "title": "API Gateway Metrics"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/aws/lambda/CIAlertStack-ProcessorFunction'\n| fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 20",
        "region": "us-west-2",
        "title": "Recent Errors"
      }
    }
  ]
}
EOF

# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name CIAlert-Production \
  --dashboard-body file://dashboard.json \
  --region us-west-2
```

**Access Dashboard:**
```
https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=CIAlert-Production
```

---

## 4. CloudWatch Alarms

### Critical Alarms

#### **High Error Rate Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name CIAlert-HighErrorRate \
  --alarm-description "Alert when Lambda error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=CIAlertStack-ProcessorFunction \
  --alarm-actions arn:aws:sns:us-west-2:ACCOUNT_ID:CIAlert-Alerts \
  --region us-west-2
```

#### **High Latency Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name CIAlert-HighLatency \
  --alarm-description "Alert when API latency exceeds 2 seconds" \
  --metric-name Latency \
  --namespace AWS/ApiGateway \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 2000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ApiId,Value=YOUR_API_ID \
  --alarm-actions arn:aws:sns:us-west-2:ACCOUNT_ID:CIAlert-Alerts \
  --region us-west-2
```

#### **DynamoDB Throttling Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name CIAlert-DynamoDBThrottling \
  --alarm-description "Alert when DynamoDB requests are throttled" \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=CIAlertStack-InsightsTable \
  --alarm-actions arn:aws:sns:us-west-2:ACCOUNT_ID:CIAlert-Alerts \
  --region us-west-2
```

---

## 5. CloudWatch Insights Queries

### Useful Log Queries

#### **Error Analysis**
```sql
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| stats count() by @logStream
| sort count desc
```

#### **Slow Requests**
```sql
fields @timestamp, @message, @duration
| filter @duration > 2000
| sort @duration desc
| limit 20
```

#### **AI Model Performance**
```sql
fields @timestamp, molecule, model, latency_ms, cost_usd, confidence_score
| filter model = "claude-3-5-haiku-20241022"
| stats avg(latency_ms) as avg_latency, 
        max(latency_ms) as max_latency,
        sum(cost_usd) as total_cost,
        avg(confidence_score) as avg_confidence
by bin(5m)
```

#### **User Activity**
```sql
fields @timestamp, userId, action, molecule
| filter action in ["view_insights", "add_watchlist", "chat_query"]
| stats count() by userId, action
| sort count desc
```

#### **API Endpoint Usage**
```sql
fields @timestamp, httpMethod, routeKey, status, responseLatency
| stats count() as requests,
        avg(responseLatency) as avg_latency,
        pct(responseLatency, 95) as p95_latency
by routeKey
| sort requests desc
```

---

## 6. X-Ray Tracing

### Enable X-Ray for Lambda

```python
# Add to Lambda function
import aws_xray_sdk.core
from aws_xray_sdk.core import xray_recorder

# Patch libraries
aws_xray_sdk.core.patch_all()

@xray_recorder.capture('process_article')
def process_article(article):
    # Your code here
    pass

# Add subsegments
subsegment = xray_recorder.begin_subsegment('bedrock_api_call')
try:
    response = bedrock.invoke_model(...)
    subsegment.put_metadata('model', 'claude-3-5-haiku')
    subsegment.put_annotation('molecule', molecule_name)
finally:
    xray_recorder.end_subsegment()
```

### View X-Ray Traces
```bash
# Get trace summaries
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --region us-west-2

# Get specific trace
aws xray batch-get-traces \
  --trace-ids TRACE_ID \
  --region us-west-2
```

---

## 7. Cost Monitoring

### Track Costs by Service

```bash
# Get cost by service (last 30 days)
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d '30 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region us-east-1

# Get Lambda costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d '30 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --filter file://filter.json \
  --region us-east-1

# filter.json
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["AWS Lambda"]
  }
}
```

### Bedrock Cost Tracking

```python
# Track Bedrock costs in Lambda
def calculate_bedrock_cost(input_tokens, output_tokens, model):
    pricing = {
        'claude-3-5-haiku-20241022': {
            'input': 0.00025 / 1000,   # $0.25 per 1M tokens
            'output': 0.00125 / 1000   # $1.25 per 1M tokens
        },
        'claude-3-5-sonnet-20241022': {
            'input': 0.003 / 1000,     # $3 per 1M tokens
            'output': 0.015 / 1000     # $15 per 1M tokens
        }
    }
    
    cost = (input_tokens * pricing[model]['input'] + 
            output_tokens * pricing[model]['output'])
    
    # Publish to CloudWatch
    cloudwatch.put_metric_data(
        Namespace='CIAlert/Costs',
        MetricData=[{
            'MetricName': 'BedrockCost',
            'Value': cost,
            'Unit': 'None',
            'Dimensions': [{'Name': 'Model', 'Value': model}]
        }]
    )
    
    return cost
```

---

## 8. Performance Baselines

### Key Performance Indicators (KPIs)

| Metric | Target | Alert Threshold | Critical Threshold |
|--------|--------|-----------------|-------------------|
| API Latency (p95) | < 500ms | > 1000ms | > 2000ms |
| Lambda Duration | < 2000ms | > 5000ms | > 10000ms |
| Error Rate | < 0.1% | > 1% | > 5% |
| DynamoDB Latency | < 20ms | > 50ms | > 100ms |
| AI Model Latency | < 2000ms | > 5000ms | > 10000ms |
| Ingestion Success Rate | > 99% | < 95% | < 90% |
| Email Delivery Rate | > 99% | < 95% | < 90% |
| Knowledge Base Hit Rate | > 80% | < 60% | < 40% |

---

## 9. Monitoring Scripts

### Daily Health Check Script

```bash
#!/bin/bash
# daily-health-check.sh

echo "🏥 CI Alert System Health Check"
echo "================================"
echo ""

# Check Lambda errors (last 24h)
ERRORS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=CIAlertStack-ProcessorFunction \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum \
  --region us-west-2 \
  --query 'Datapoints[0].Sum' \
  --output text)

echo "Lambda Errors (24h): $ERRORS"

# Check API 5xx errors
API_ERRORS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum \
  --region us-west-2 \
  --query 'Datapoints[0].Sum' \
  --output text)

echo "API 5xx Errors (24h): $API_ERRORS"

# Check DynamoDB throttles
THROTTLES=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=CIAlertStack-InsightsTable \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum \
  --region us-west-2 \
  --query 'Datapoints[0].Sum' \
  --output text)

echo "DynamoDB Throttles (24h): $THROTTLES"

# Overall health
if [ "$ERRORS" -lt 10 ] && [ "$API_ERRORS" -lt 5 ] && [ "$THROTTLES" -lt 5 ]; then
    echo ""
    echo "✅ System Health: GOOD"
else
    echo ""
    echo "⚠️ System Health: DEGRADED"
fi
```

---

## 10. Troubleshooting Guide

### Common Issues & Solutions

#### **High Lambda Duration**
```bash
# Check memory usage
aws lambda get-function-configuration \
  --function-name CIAlertStack-ProcessorFunction \
  --region us-west-2

# Increase memory if needed
aws lambda update-function-configuration \
  --function-name CIAlertStack-ProcessorFunction \
  --memory-size 1024 \
  --region us-west-2
```

#### **DynamoDB Throttling**
```bash
# Check current capacity
aws dynamodb describe-table \
  --table-name CIAlertStack-InsightsTable \
  --region us-west-2

# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/CIAlertStack-InsightsTable \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 5 \
  --max-capacity 100 \
  --region us-west-2
```

#### **API Gateway Errors**
```bash
# Check recent errors
aws logs filter-log-events \
  --log-group-name /aws/apigateway/CIAlert \
  --filter-pattern "5XX" \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --region us-west-2
```

---

## 11. Automated Reporting

### Weekly Report Script

```bash
#!/bin/bash
# weekly-report.sh

REPORT_FILE="ci-alert-weekly-report-$(date +%Y-%m-%d).txt"

cat > $REPORT_FILE << EOF
CI Alert System - Weekly Report
Generated: $(date)
================================

SYSTEM METRICS (Last 7 Days)
-----------------------------
EOF

# Add metrics to report
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 604800 \
  --statistics Sum \
  --region us-west-2 \
  --query 'Datapoints[0].Sum' \
  --output text >> $REPORT_FILE

echo "Report generated: $REPORT_FILE"

# Email report (if SES configured)
aws ses send-email \
  --from admin@yourcompany.com \
  --to team@yourcompany.com \
  --subject "CI Alert System - Weekly Report" \
  --text file://$REPORT_FILE \
  --region us-west-2
```

---

## 12. Real-Time Monitoring Dashboard

Access your monitoring dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#dashboards:name=CIAlert-Production
```

**Key Widgets:**
- Lambda invocations & errors
- API Gateway request count & latency
- DynamoDB capacity usage
- Bedrock AI costs
- Recent error logs
- User activity metrics

---

## Summary

This comprehensive logging and metrics setup provides:

✅ **Real-time monitoring** - CloudWatch Logs with live tailing  
✅ **Performance tracking** - Custom metrics for all components  
✅ **Cost visibility** - Track Bedrock and infrastructure costs  
✅ **Proactive alerts** - CloudWatch Alarms for critical issues  
✅ **Deep insights** - CloudWatch Insights queries  
✅ **Distributed tracing** - X-Ray for request flows  
✅ **Automated reporting** - Weekly health reports  
✅ **Troubleshooting tools** - Scripts for common issues  

**Total Monitoring Cost:** ~$25/month (included in $135-285 total)
