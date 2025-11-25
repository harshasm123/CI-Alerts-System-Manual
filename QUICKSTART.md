# CI Alert System - Quick Start Guide

## 🚀 Deploy in 5 Minutes

### Prerequisites
- AWS Account with credentials configured
- Node.js 18+ installed
- AWS CLI configured

### Step 1: Deploy

```bash
chmod +x quick-deploy.sh
./quick-deploy.sh
```

This will:
- Install dependencies
- Build CDK infrastructure
- Deploy to AWS
- Output API URL and User Pool ID

### Step 2: Enable Bedrock

1. Go to AWS Console
2. Navigate to Bedrock → Model Access
3. Click "Manage model access"
4. Enable "Claude 3 Sonnet"
5. Click "Save changes"

### Step 3: Test

```bash
# Get your API URL from deployment output
API_URL="<your-api-url>"

# Test insights endpoint
curl "${API_URL}insights"

# Add molecule to watchlist
curl -X POST "${API_URL}watchlist" \
  -H "Content-Type: application/json" \
  -d '{"molecule":"Keytruda"}'

# Trigger data ingestion
aws lambda invoke \
  --function-name CIAlertStack-PubMedFunction* \
  response.json
```

## 📊 What's Deployed

- ✅ 3 DynamoDB tables
- ✅ S3 bucket for data
- ✅ 4 Lambda functions
- ✅ API Gateway
- ✅ Cognito User Pool
- ✅ EventBridge schedule

## 💰 Cost

~$75/month for light usage

## 🔧 Troubleshooting

### Build fails
```bash
cd infrastructure
rm -rf node_modules
npm install
npm run build
```

### Bedrock access denied
Enable models in AWS Console → Bedrock → Model Access

### API returns 500
Check CloudWatch logs:
```bash
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --follow
```

## 📚 Full Documentation

See `DEPLOYMENT_INSTRUCTIONS.md` for complete guide.

## 🧹 Cleanup

```bash
chmod +x destroy.sh
./destroy.sh
```

## ✅ Success!

You now have a working CI Alert System that:
- Ingests pharmaceutical news from PubMed
- Processes with Bedrock Claude AI
- Provides REST API for insights
- Runs automated daily updates
