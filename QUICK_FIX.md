# Quick Fix for CloudFormation Hook Error

## Error You're Seeing:
```
AWS::EarlyValidation::ResourceExistenceCheck FAILED
```

## Fix in 3 Steps:

### Step 1: Run the Fix Script
```bash
chmod +x fix-region.sh
./fix-region.sh
```

### Step 2: Verify Region Changed
```bash
aws configure get region
# Should show: us-east-1
```

### Step 3: Deploy Again
```bash
./deploy.sh
```

## That's It! ✅

---

## If That Doesn't Work:

### Manual Fix:
```bash
# 1. Switch region
aws configure set region us-east-1

# 2. Delete failed stack
aws cloudformation delete-stack --stack-name CDKToolkit
aws cloudformation wait stack-delete-complete --stack-name CDKToolkit

# 3. Clear cache
rm -rf ~/.cdk

# 4. Deploy
./deploy.sh
```

---

## Why This Happens:

Your current AWS region has a CloudFormation validation hook that blocks CDK bootstrap. Switching to `us-east-1` avoids this issue.

**Problematic Regions**: us-west-2, eu-west-1, ap-southeast-1
**Safe Regions**: us-east-1, us-east-2, us-west-1

---

For detailed explanation, see: `CLOUDFORMATION_HOOK_FIX.md`
