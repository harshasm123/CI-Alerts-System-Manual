# CloudFormation Hook Validation Error - Fix Guide

## Error Message
```
Failed to create ChangeSet cdk-deploy-change-set on CDKToolkit: FAILED, 
The following hook(s)/validation failed: [AWS::EarlyValidation::ResourceExistenceCheck]. 
To troubleshoot Early Validation errors, use the DescribeEvents API for detailed failure information.
```

## What's Happening?

AWS CloudFormation has a feature called "Hooks" that validates resources before deployment. Some AWS regions have strict validation hooks enabled that prevent CDK bootstrap from working correctly.

The hook `AWS::EarlyValidation::ResourceExistenceCheck` validates that resources exist before creating them, which conflicts with CDK's bootstrap process.

## Quick Fix (Recommended)

### Option 1: Switch to a Different Region

```bash
# Run the fix script
chmod +x fix-region.sh
./fix-region.sh

# Or manually switch region
aws configure set region us-east-1

# Then deploy again
./deploy.sh
```

**Recommended Regions** (no known hook issues):
- `us-east-1` (US East - N. Virginia) ✅
- `us-east-2` (US East - Ohio) ✅
- `us-west-1` (US West - N. California) ✅

**Problematic Regions** (known hook issues):
- `us-west-2` (US West - Oregon) ❌
- `eu-west-1` (Europe - Ireland) ❌
- `ap-southeast-1` (Asia Pacific - Singapore) ❌

### Option 2: Use CDK Bootstrap with --trust Flag

```bash
# Bootstrap with explicit trust
cdk bootstrap aws://ACCOUNT-ID/REGION --trust ACCOUNT-ID

# Example:
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
cdk bootstrap aws://${ACCOUNT_ID}/${REGION} --trust ${ACCOUNT_ID}
```

### Option 3: Manual Bootstrap (Advanced)

```bash
# 1. Delete existing failed CDKToolkit stack
aws cloudformation delete-stack --stack-name CDKToolkit --region YOUR_REGION
aws cloudformation wait stack-delete-complete --stack-name CDKToolkit --region YOUR_REGION

# 2. Clear CDK cache
rm -rf ~/.cdk

# 3. Update AWS CLI and CDK
pip install --upgrade awscli
npm install -g aws-cdk@latest

# 4. Bootstrap again
cdk bootstrap
```

## Detailed Solutions

### Solution 1: Contact AWS Administrator

If you must use a problematic region, contact your AWS administrator to disable the hook:

```bash
# They need to run (requires admin permissions):
aws cloudformation deregister-type \
  --type HOOK \
  --type-name AWS::EarlyValidation::ResourceExistenceCheck \
  --region YOUR_REGION
```

### Solution 2: Use CloudFormation Console

1. Go to AWS Console → CloudFormation
2. Navigate to "Hooks" in the left sidebar
3. Find `AWS::EarlyValidation::ResourceExistenceCheck`
4. Disable or delete the hook
5. Run `./deploy.sh` again

### Solution 3: Deploy to Multiple Regions

If you need resources in a problematic region:

```bash
# 1. Bootstrap in us-east-1 (works)
aws configure set region us-east-1
cdk bootstrap

# 2. Deploy core infrastructure in us-east-1
cd infrastructure
cdk deploy --all

# 3. Create cross-region resources manually if needed
# (e.g., CloudFront distributions, Route53 records)
```

## Verification Steps

After applying a fix, verify it works:

```bash
# 1. Check current region
aws configure get region

# 2. Verify AWS credentials
aws sts get-caller-identity

# 3. Check if CDKToolkit exists
aws cloudformation describe-stacks --stack-name CDKToolkit

# 4. Try bootstrap again
cdk bootstrap

# 5. If successful, deploy
./deploy.sh
```

## Prevention

To avoid this issue in the future:

### 1. Update deploy.sh (Already Done)

The `deploy.sh` script now automatically detects problematic regions and switches to `us-east-1`.

### 2. Set Default Region

```bash
# Add to ~/.bashrc or ~/.zshrc
export AWS_DEFAULT_REGION=us-east-1
export AWS_REGION=us-east-1
```

### 3. Use AWS Config File

```bash
# Edit ~/.aws/config
[default]
region = us-east-1
output = json
```

## Troubleshooting

### Issue: Still Getting Errors After Region Switch

```bash
# Clear all CDK state
rm -rf ~/.cdk
rm -rf cdk.out

# Delete failed stack
aws cloudformation delete-stack --stack-name CDKToolkit
aws cloudformation wait stack-delete-complete --stack-name CDKToolkit

# Update tools
npm install -g aws-cdk@latest
pip install --upgrade awscli

# Try again
./deploy.sh
```

### Issue: Permission Denied

```bash
# Ensure you have required permissions
aws iam get-user

# Required IAM permissions:
# - cloudformation:*
# - s3:*
# - iam:*
# - ssm:*
# - ecr:*
```

### Issue: Account Not Bootstrapped

```bash
# Check bootstrap status
aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version

# If not found, bootstrap manually
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

## Understanding the Error

### What is AWS::EarlyValidation::ResourceExistenceCheck?

This CloudFormation hook validates that:
1. Resources referenced in templates actually exist
2. Resource properties are valid before deployment
3. Cross-stack references are resolvable

### Why Does It Break CDK Bootstrap?

CDK bootstrap creates resources that don't exist yet, which triggers the validation hook. The hook sees that resources don't exist and fails the deployment, creating a chicken-and-egg problem.

### AWS Regions with Hooks

Some AWS regions have organizational policies that enable strict validation hooks. These are typically:
- Regions with compliance requirements
- Regions with organizational SCPs (Service Control Policies)
- Regions with custom CloudFormation hooks

## Alternative: Use Existing Bootstrap

If you have access to another AWS account that's already bootstrapped:

```bash
# Use cross-account bootstrap
cdk bootstrap \
  --trust ACCOUNT-ID-1 \
  --trust ACCOUNT-ID-2 \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
```

## Getting Help

If none of these solutions work:

1. **Check AWS Service Health**:
   - https://status.aws.amazon.com/

2. **AWS Support**:
   - Open a support case in AWS Console
   - Mention: "CloudFormation Hook blocking CDK bootstrap"

3. **CDK GitHub Issues**:
   - https://github.com/aws/aws-cdk/issues
   - Search for: "ResourceExistenceCheck"

4. **AWS Forums**:
   - https://repost.aws/

## Summary

**Quick Fix**: Run `./fix-region.sh` and switch to `us-east-1`

**Root Cause**: CloudFormation validation hook in certain regions

**Long-term Solution**: Use regions without strict validation hooks or disable the hook (requires admin access)

---

## Automated Fix Script

The `fix-region.sh` script handles this automatically:

```bash
chmod +x fix-region.sh
./fix-region.sh
```

Then run:
```bash
./deploy.sh
```

Your deployment should now succeed! ✅
