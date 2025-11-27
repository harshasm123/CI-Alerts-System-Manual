# CI Alert System - Complete Deployment Guide

## Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install AWS CDK
npm install -g aws-cdk

# Install Python
sudo apt-get install -y python3-pip
pip3 install boto3

# Configure AWS
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output (json)
```

---

## Step 1: Bootstrap CDK

```bash
bash check-bootstrap.sh
cd infrastructure
cdk bootstrap
cd ..
```

---

## Step 2: Deploy Infrastructure

```bash
bash deploy.sh
```

**Deploys 4 stacks (~8-10 minutes):**
1. CIAlertStack - Core (DynamoDB, Lambda, API Gateway, Cognito, SQS, EventBridge)
2. CIAlert-Frontend - S3 + CloudFront
3. CIAlert-Monitoring - CloudWatch
4. CIAlert-CICD - CodePipeline (optional)

---

## Step 3: Setup SES Email

```bash
bash setup-ses.sh
```

Enter your email address and verify it by clicking the link in your inbox.

---

## Step 4: Deploy Frontend

```bash
bash deploy-cognito-frontend.sh
```

**This will (~3-5 minutes):**
- Get Cognito config from stack outputs
- Build React app with AWS Amplify
- Upload to S3
- Invalidate CloudFront cache

---

## Step 5: Create Test User

```bash
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)

# Sign up
aws cognito-idp sign-up \
  --client-id $USER_POOL_CLIENT_ID \
  --username test@example.com \
  --password Test123! \
  --user-attributes Name=email,Value=test@example.com

# Confirm (skip email verification)
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com
```

---

## Step 6: Add User Email for Digests

```bash
SETTINGS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'UserSettings')]|[0]" --output text)

aws dynamodb put-item \
  --table-name $SETTINGS_TABLE \
  --item '{
    "userId":{"S":"test@example.com"},
    "email":{"S":"YOUR_VERIFIED_EMAIL"},
    "digestEnabled":{"BOOL":true}
  }'
```

Replace `YOUR_VERIFIED_EMAIL` with the email you verified in Step 3.

---

## Step 7: Trigger Test Ingestion

```bash
bash test.sh ingestion
```

This creates test insights for Keytruda and Opdivo.

---

## Step 8: Test Daily Digest

```bash
bash test.sh digest
```

Check your email for the digest.

---

## Step 9: Access Frontend

```bash
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text)
echo "Frontend: $CLOUDFRONT_URL"
```

**Login with:**
- Email: `test@example.com`
- Password: `Test123!`

---

## Testing

### Test Cognito Configuration
```bash
bash test.sh cognito
```

### Test Full System
```bash
bash test.sh system
```

### Test API Endpoints
```bash
bash test.sh api
```

---

## Troubleshooting

### Issue: Frontend shows 401 Unauthorized

**Solution:**
```bash
# Confirm user
aws cognito-idp admin-confirm-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com

# Or sign out and sign in again in the UI
```

### Issue: No insights in UI

**Solution:**
```bash
# Trigger ingestion
bash test.sh ingestion

# Wait 15 seconds for processing
sleep 15

# Check insights table
INSIGHTS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'Insights')]|[0]" --output text)
aws dynamodb scan --table-name $INSIGHTS_TABLE --max-items 5

# Check processor logs
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --since 10m
```

### Issue: No email digest received

**Solution:**
```bash
# 1. Verify SES email
bash setup-ses.sh

# 2. Check email in UserSettings table
SETTINGS_TABLE=$(aws dynamodb list-tables --query "TableNames[?contains(@,'UserSettings')]|[0]" --output text)
aws dynamodb scan --table-name $SETTINGS_TABLE

# 3. Test digest manually
bash test.sh digest

# 4. Check digest logs
aws logs tail /aws/lambda/CIAlertStack-DigestFunction --since 10m
```

### Issue: Frontend not loading

**Solution:**
```bash
# Invalidate CloudFront cache
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' --output text)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"

# Wait 2-3 minutes for invalidation
```

### Issue: Bootstrap fails

**Solution:**
```bash
# Ensure region is us-east-1
export AWS_REGION=us-east-1
aws configure set region us-east-1

# Re-bootstrap
cd infrastructure
cdk bootstrap
cd ..
```

---

## Daily Operations

### View Logs
```bash
# PubMed ingestion
aws logs tail /aws/lambda/CIAlertStack-PubMedFunction --follow

# Processor
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --follow

# Digest
aws logs tail /aws/lambda/CIAlertStack-DigestFunction --follow
```

### Check EventBridge Rules
```bash
# List all rules
aws events list-rules

# Check ingestion rule (midnight UTC)
aws events describe-rule --name CIAlertStack-DailyIngestionRule

# Check digest rule (9 AM UTC)
aws events describe-rule --name CIAlertStack-DailyDigestRule
```

### Monitor CloudWatch Dashboard
```bash
# Get dashboard URL
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:"
```

---

## Cleanup

```bash
# Delete all stacks
cd infrastructure
cdk destroy --all

# Or manually
aws cloudformation delete-stack --stack-name CIAlert-CICD
aws cloudformation delete-stack --stack-name CIAlert-Monitoring
aws cloudformation delete-stack --stack-name CIAlert-Frontend
aws cloudformation delete-stack --stack-name CIAlertStack

# Wait for completion
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack
```

---

## Success Checklist

- [ ] All 4 stacks deployed successfully
- [ ] SES email verified
- [ ] Frontend accessible via CloudFront URL
- [ ] User can sign in with Cognito
- [ ] Watchlist CRUD operations work
- [ ] Insights visible in UI
- [ ] Test email digest received
- [ ] CloudWatch dashboard shows metrics
- [ ] EventBridge rules active

---

## Next Steps

1. **Add More Molecules** - Use the UI to add molecules to your watchlist
2. **Customize Email Template** - Edit `lambdas/notifications/daily_digest.py`
3. **Add Data Sources** - Integrate FDA, EMA, WIPO APIs
4. **Custom Domain** - Set up Route53 and ACM certificate
5. **Production Email** - Move SES out of sandbox mode
6. **Monitoring Alerts** - Configure SNS for CloudWatch alarms

---

## Cost Optimization Tips

- Use S3 lifecycle policies for old data
- Enable DynamoDB auto-scaling if needed
- Use Lambda reserved concurrency for predictable costs
- Set CloudWatch Logs retention to 7 days
- Monitor with AWS Cost Explorer

---

## Security Best Practices

- ✅ Rotate AWS credentials regularly
- ✅ Enable MFA on AWS account
- ✅ Use AWS Secrets Manager for sensitive data
- ✅ Review IAM policies quarterly
- ✅ Enable CloudTrail for audit logs
- ✅ Use VPC endpoints for private connectivity

---

## Support

For issues:
1. Check logs: `aws logs tail /aws/lambda/FUNCTION_NAME --follow`
2. Run system test: `bash test-system.sh`
3. Review CloudWatch dashboard
4. Check this troubleshooting section
5. Review [README.md](README.md) for architecture details
