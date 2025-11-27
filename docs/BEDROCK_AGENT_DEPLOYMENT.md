# Bedrock Agent Deployment Guide

## Overview

This guide covers deploying the interactive Bedrock Agent with chat UI for the CI Alert System.

---

## Prerequisites

1. **Enable Bedrock Models**
```bash
# AWS Console → Bedrock → Model Access
# Enable: Anthropic Claude 3 Sonnet
```

2. **Verify Bedrock Access**
```bash
aws bedrock list-foundation-models --region us-east-1 \
  --query 'modelSummaries[?contains(modelId, `claude-3-sonnet`)].modelId'
```

---

## Deployment Steps

### Step 1: Update CDK App to Include Agent Stack

```bash
# Edit infrastructure/bin/ci-alert.ts
# Add BedrockAgentStack after CIAlertStack
```

### Step 2: Install Dependencies

```bash
cd infrastructure
npm install
npm run build
```

### Step 3: Deploy Bedrock Agent Stack

```bash
cd infrastructure
cdk deploy BedrockAgentStack
```

**This creates:**
- Bedrock Agent with Claude 3 Sonnet
- Action Lambda for querying insights
- Agent Alias for production use

### Step 4: Get Agent IDs

```bash
AGENT_ID=$(aws cloudformation describe-stacks --stack-name BedrockAgentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentIdOutput`].OutputValue' --output text)

AGENT_ALIAS_ID=$(aws cloudformation describe-stacks --stack-name BedrockAgentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentAliasIdOutput`].OutputValue' --output text)

echo "Agent ID: $AGENT_ID"
echo "Agent Alias ID: $AGENT_ALIAS_ID"
```

### Step 5: Add Agent API to Core Stack

Update `infrastructure/lib/ci-alert-stack.ts` to add agent API endpoint:

```typescript
// Add Agent API Lambda
const agentApiFunction = new lambda.Function(this, 'AgentApiFunction', {
  runtime: lambda.Runtime.PYTHON_3_12,
  handler: 'agent_api.lambda_handler',
  code: lambda.Code.fromAsset('../lambdas/api'),
  timeout: cdk.Duration.seconds(60),
  role: lambdaRole,
  environment: {
    AGENT_ID: 'YOUR_AGENT_ID',
    AGENT_ALIAS_ID: 'YOUR_AGENT_ALIAS_ID',
  },
});

// Add /agent endpoint
const agentResource = api.root.addResource('agent');
agentResource.addMethod('POST', new apigateway.LambdaIntegration(agentApiFunction), {
  authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

### Step 6: Redeploy Core Stack

```bash
cd infrastructure
cdk deploy CIAlertStack
```

### Step 7: Deploy Frontend with Chat

```bash
bash deploy-cognito-frontend.sh
```

---

## Testing

### Test Agent via CLI

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)

# Get auth token (from Cognito sign-in)
TOKEN="YOUR_JWT_TOKEN"

# Test agent
curl -X POST "${API_URL}agent" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"What are the latest insights for Keytruda?"}'
```

### Test via Frontend

1. Open CloudFront URL
2. Sign in with Cognito
3. Click "🤖 AI Assistant" tab
4. Ask: "What are the latest insights for Keytruda?"

---

## Example Queries

### Query Insights
```
What are the latest insights for Keytruda?
```

### Analyze Trends
```
Analyze sentiment trends for Opdivo over the past 30 days
```

### Compare Molecules
```
Compare Keytruda and Opdivo
```

### General Questions
```
What FDA approvals happened recently?
What molecules should I be tracking?
Tell me about competitive threats in melanoma
```

---

## Cost Estimate

### Monthly Cost (100 queries/day)

```
Bedrock Agent:
- 100 queries/day × 30 days = 3,000 queries
- Average 3 actions per query = 9,000 actions
- Input: 3,000 × 1,000 tokens = 3M tokens
- Output: 3,000 × 500 tokens = 1.5M tokens
- Actions: 9,000 × 200 tokens = 1.8M tokens

Total tokens: 6.3M
Cost: 6.3M × $3/1M input + 1.5M × $15/1M output = $41.40/month

Lambda:
- Agent API: 3,000 invocations × $0.20/1M = $0.60
- Action Lambda: 9,000 invocations × $0.20/1M = $1.80

Total: ~$44/month
```

---

## Troubleshooting

### Issue: Agent not responding

**Check agent status:**
```bash
aws bedrock-agent get-agent --agent-id $AGENT_ID
```

**Check action Lambda logs:**
```bash
aws logs tail /aws/lambda/BedrockAgentStack-ActionLambda --follow
```

### Issue: "Agent not found" error

**Verify agent alias:**
```bash
aws bedrock-agent list-agent-aliases --agent-id $AGENT_ID
```

### Issue: Action Lambda timeout

**Increase timeout in CDK:**
```typescript
timeout: cdk.Duration.seconds(120)
```

---

## Monitoring

### CloudWatch Metrics

```bash
# Agent invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name Invocations \
  --dimensions Name=AgentId,Value=$AGENT_ID \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### View Agent Logs

```bash
# Agent API logs
aws logs tail /aws/lambda/CIAlertStack-AgentApiFunction --follow

# Action Lambda logs
aws logs tail /aws/lambda/BedrockAgentStack-ActionLambda --follow
```

---

## Cleanup

```bash
# Delete agent stack
cd infrastructure
cdk destroy BedrockAgentStack

# Or manually
aws cloudformation delete-stack --stack-name BedrockAgentStack
```

---

## Next Steps

1. **Add More Actions:** Extend action_handler.py with more capabilities
2. **Knowledge Base:** Add S3 + OpenSearch for RAG
3. **Multi-turn Conversations:** Implement session management
4. **Voice Interface:** Add speech-to-text/text-to-speech
5. **Mobile App:** Build React Native app with chat

---

## Summary

✅ Interactive AI assistant with natural language queries  
✅ Multi-step reasoning and analysis  
✅ Real-time insights from DynamoDB  
✅ Secure Cognito authentication  
✅ Modern chat UI with React  
✅ Production-ready monitoring  

**Cost:** ~$44/month for 100 queries/day
