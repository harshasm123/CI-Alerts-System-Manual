# Frontend-Backend Connection Fixes

## Issues Fixed

### 1. **API URL Configuration**
- **Problem**: Frontend .env had placeholder values
- **Fix**: Updated `deploy-cognito-frontend.sh` to properly inject real API URL from CloudFormation outputs
- **Impact**: Frontend can now connect to backend API

### 2. **API Path Mismatch**
- **Problem**: Frontend was calling `/v1/watchlist` but API Gateway routes are at `/watchlist`
- **Fix**: Removed `/v1/` prefix from all frontend API calls in `App.js`
- **Impact**: API requests now reach the correct endpoints

### 3. **DynamoDB Key Inconsistency**
- **Problem**: `user_settings_api.py` used `user_id` but DynamoDB table expects `userId`
- **Fix**: Changed all `user_id` keys to `userId` in user_settings_api.py
- **Impact**: Settings can now be saved and retrieved correctly

### 4. **Watchlist userId Parameter**
- **Problem**: Frontend was sending `userId` in request body, but Lambda extracts it from JWT token
- **Fix**: Removed `userId` from POST request body in `addMolecule()` function
- **Impact**: Molecules can now be added to watchlist

### 5. **Cognito User Confirmation Command**
- **Problem**: AWS CLI command was missing `--region` parameter
- **Fix**: Added `--region $REGION` to admin-confirm-user command
- **Impact**: Users can be manually confirmed if auto-verify fails

## Files Modified

### Backend (Lambda Functions)
- `lambdas/api/user_settings_api.py`
  - Changed `user_id` to `userId` in DynamoDB operations
  - Fixed key consistency across all functions

### Frontend
- `frontend/src/App.js`
  - Removed `/v1/` prefix from API URLs
  - Removed `userId` from POST body (extracted from JWT)
  - Fixed URL encoding for DELETE requests

### Deployment Scripts
- `shell scripts/deploy-cognito-frontend.sh`
  - Added API URL validation (ensures trailing slash)
  - Added debug output for configuration values
  - Fixed Cognito command with region parameter

### New Files
- `redeploy-fixes.sh` - Quick script to redeploy all fixes

## How to Apply Fixes

Run the redeploy script:

```bash
bash redeploy-fixes.sh
```

This will:
1. Rebuild and redeploy Lambda functions
2. Rebuild and redeploy frontend with correct configuration
3. Upload updated frontend to S3

## Testing After Deployment

1. **Clear browser cache** or open in incognito mode
2. **Sign in** to your application
3. **Test Watchlist**:
   - Add a molecule (e.g., "pembrolizumab")
   - Verify it appears in the list
   - Try removing it
4. **Test Settings**:
   - Update notification email
   - Change alert threshold
   - Click "Save Settings"
   - Refresh page to verify settings persist
5. **Test Insights**:
   - Should load without errors (may be empty initially)

## Troubleshooting

### If settings still don't save:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/CIAlertStack-UserSettingsFunction --follow --region us-east-1
```

### If watchlist doesn't load:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/CIAlertStack-WatchlistFunction --follow --region us-east-1
```

### If you see CORS errors:
- The Lambda functions already have CORS headers
- Make sure you're accessing the site via the S3 website URL (not the S3 bucket URL)

### Browser Console Errors:
- Press F12 to open developer tools
- Check Console tab for JavaScript errors
- Check Network tab to see API request/response details

## API Endpoints (Correct Format)

Your API base URL: `https://ie6dvq0tv9.execute-api.us-east-1.amazonaws.com/prod/`

Endpoints:
- `GET /watchlist` - Get user's watchlist
- `POST /watchlist` - Add molecule (body: `{"molecule": "name"}`)
- `DELETE /watchlist?molecule=name` - Remove molecule
- `GET /insights` - Get all insights
- `GET /insights?molecule=name` - Get insights for specific molecule
- `GET /user-settings` - Get user settings
- `PUT /user-settings` - Update settings

All requests require `Authorization` header with JWT token from Cognito.

## What's Working Now

✅ S3 static website hosting (no CloudFront needed)
✅ Cognito authentication
✅ API Gateway with CORS
✅ Lambda functions with correct DynamoDB keys
✅ Frontend with correct API paths
✅ Settings persistence
✅ Watchlist management

## What's Next

After these fixes are deployed:
1. Add molecules to your watchlist
2. Trigger data ingestion to populate insights
3. Configure email notifications in settings
4. Use the AI Assistant (if Bedrock is enabled)
