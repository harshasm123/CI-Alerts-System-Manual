# Complete Deployment Steps

## Current Status
✅ All code fixes applied
✅ S3 static website hosting configured (no CloudFront needed)
✅ Backend API endpoints fixed
✅ Frontend configuration updated
✅ AI Assistant endpoint added

## What You Need to Do Now

### Step 1: Deploy Everything
```bash
bash deploy.sh
```

This will:
- Deploy all infrastructure (DynamoDB, Lambda, API Gateway, Cognito, S3)
- Build and deploy the frontend with correct configuration
- Output your website URL

### Step 2: Access Your Application
After deployment completes, you'll see output like:
```
🌐 Frontend URL: http://cialert-frontend-websitebucket-xxxxx.s3-website-us-east-1.amazonaws.com
```

Open that URL in your browser.

### Step 3: Sign In
Use the credentials you created earlier:
- Email: harshasm123@gmail.com
- Password: (your password)

### Step 4: Test Features

#### Test Watchlist:
1. Go to "Watchlist" tab
2. Add a molecule (e.g., "pembrolizumab" or "Keytruda")
3. Verify it appears in the list
4. Try removing it

#### Test Settings:
1. Go to "Settings" tab
2. Update your notification email
3. Change alert threshold
4. Click "Save Settings"
5. Refresh the page - settings should persist

#### Test Insights:
1. Insights will be empty initially
2. Run this command to trigger data ingestion:
   ```bash
   bash trigger-ingestion.sh
   ```
3. Wait 2-3 minutes
4. Refresh the "Insights" tab
5. You should see insights for molecules in your watchlist

#### Test AI Assistant:
1. Go to "AI Assistant" tab
2. Type a question like "What are the latest insights for Keytruda?"
3. If you get "Network error":
   - Make sure Bedrock Agent is deployed: `cdk deploy CIAlert-BedrockAgent`
   - Enable Bedrock models in AWS Console → Bedrock → Model Access
   - Prepare the agent:
     ```bash
     AGENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-BedrockAgent --query 'Stacks[0].Outputs[?OutputKey==`AgentId`].OutputValue' --output text)
     aws bedrock-agent prepare-agent --agent-id $AGENT_ID --region us-east-1
     ```

## Troubleshooting

### If Settings Don't Save:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/CIAlertStack-UserSettingsFunction --follow
```

### If Watchlist Doesn't Work:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/CIAlertStack-WatchlistFunction --follow
```

### If AI Assistant Shows Network Error:
1. Check if agent endpoint exists:
   ```bash
   aws apigateway get-resources --rest-api-id YOUR_API_ID
   ```
2. Verify Bedrock Agent is deployed and prepared
3. Check Lambda logs:
   ```bash
   aws logs tail /aws/lambda/CIAlertStack-AgentFunction --follow
   ```

### If Frontend Shows Old Version:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Or open in incognito/private mode
3. Or hard refresh (Ctrl+F5)

## What's Fixed

✅ **Backend Issues:**
- DynamoDB key mismatch (user_id → userId)
- Missing /agent endpoint for AI Assistant
- Bedrock Agent permissions added

✅ **Frontend Issues:**
- API URL configuration (removed /v1/ prefix)
- Request parameters fixed
- Environment variables properly injected

✅ **Deployment Issues:**
- CloudFront bypassed (using S3 static website)
- Automated frontend deployment in deploy.sh
- Proper .env file generation

## Next Steps After Everything Works

1. **Add More Molecules**: Build your watchlist with pharmaceutical molecules you want to track
2. **Schedule Ingestion**: The system runs daily at midnight UTC automatically
3. **Configure Email**: Set up SES for email notifications
4. **Enable Bedrock**: Get access to Amazon Bedrock models for AI features
5. **Add CloudFront**: Once your AWS account is verified, add CloudFront for HTTPS

## Quick Commands Reference

```bash
# Full deployment
bash deploy.sh

# Trigger data ingestion
bash trigger-ingestion.sh

# Redeploy just frontend
bash "shell scripts/deploy-cognito-frontend.sh"

# Check API Gateway URL
aws cloudformation describe-stacks --stack-name CIAlertStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text

# Check website URL
aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' --output text

# View Lambda logs
aws logs tail /aws/lambda/FUNCTION_NAME --follow
```

## Support

If you encounter issues:
1. Check browser console (F12) for JavaScript errors
2. Check Lambda logs for backend errors
3. Verify all stacks are deployed: `aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE`
4. Review FRONTEND_BACKEND_FIXES.md for detailed fix information
