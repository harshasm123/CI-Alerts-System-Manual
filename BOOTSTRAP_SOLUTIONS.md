# CDK Bootstrap Solutions - Complete Guide

## Your Error:
```
Failed to create ChangeSet cdk-deploy-change-set on CDKToolkit: FAILED
The following hook(s)/validation failed: [AWS::EarlyValidation::ResourceExistenceCheck]
```

## Root Cause:
Your AWS account has **organizational policies** or **SCPs (Service Control Policies)** that enable CloudFormation validation hooks across **ALL regions**, including us-east-1.

This is common in:
- Enterprise AWS accounts
- AWS Organizations with strict governance
- Accounts with compliance requirements (HIPAA, PCI-DSS, etc.)

---

## Solution 1: Manual Bootstrap (RECOMMENDED) ✅

This bypasses CloudFormation entirely by creating CDK resources directly via AWS APIs.

### Step 1: Run Manual Bootstrap
```bash
chmod +x bootstrap-manual.sh
./bootstrap-manual.sh
```

### Step 2: Verify Bootstrap
```bash
# Check SSM parameter
aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version

# Check S3 bucket
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
aws s3 ls cdk-hnb659fds-assets-${ACCOUNT_ID}-${REGION}

# Check IAM roles
aws iam get-role --role-name cdk-hnb659fds-cfn-exec-role-${ACCOUNT_ID}-${REGION}
```

### Step 3: Deploy
```bash
./deploy.sh
```

**What This Does:**
- Creates S3 bucket for CDK assets
- Creates ECR repository for Docker images
- Creates SSM parameter for version tracking
- Creates 5 IAM roles for CDK operations
- **Bypasses CloudFormation hooks completely**

---

## Solution 2: Contact AWS Administrator

If manual bootstrap fails due to IAM permissions, contact your AWS administrator:

### What to Ask For:

**Option A: Disable the Hook (Preferred)**
```bash
# Admin needs to run:
aws cloudformation deregister-type \
  --type HOOK \
  --type-name AWS::EarlyValidation::ResourceExistenceCheck \
  --region us-east-1
```

**Option B: Grant Permissions**
Ask for these IAM permissions:
- `s3:CreateBucket`, `s3:PutBucketVersioning`, `s3:PutBucketEncryption`
- `ecr:CreateRepository`
- `ssm:PutParameter`
- `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:PutRolePolicy`

**Option C: Pre-Bootstrap Account**
Ask admin to run CDK bootstrap from an admin account:
```bash
cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-1 \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
```

---

## Solution 3: Use Different AWS Account

If you have access to another AWS account without these restrictions:

```bash
# Configure different account
aws configure --profile personal
aws configure set region us-east-1 --profile personal

# Bootstrap and deploy there
export AWS_PROFILE=personal
./deploy.sh
```

---

## Solution 4: Deploy Without CDK Bootstrap (Advanced)

If all else fails, deploy resources manually:

### Step 1: Synthesize CloudFormation Templates
```bash
cd infrastructure
npm install
npm run build
cdk synth --all
```

### Step 2: Deploy via AWS Console
1. Go to AWS Console → CloudFormation
2. Create Stack → Upload template
3. Upload files from `cdk.out/` directory
4. Deploy each stack manually

**Note:** This is tedious but works when automation is blocked.

---

## Troubleshooting

### Issue: Manual Bootstrap Fails with Permission Errors

```bash
# Check your IAM permissions
aws iam get-user
aws iam list-attached-user-policies --user-name YOUR_USERNAME

# You need these permissions:
# - s3:* or s3:CreateBucket, s3:PutBucket*
# - ecr:* or ecr:CreateRepository
# - ssm:* or ssm:PutParameter
# - iam:* or iam:CreateRole, iam:AttachRolePolicy
```

**Fix:** Ask AWS admin for these permissions or use Solution 2.

### Issue: "Access Denied" on S3 Bucket Creation

```bash
# Your account may have S3 restrictions
# Try with a different bucket name prefix
# Edit bootstrap-manual.sh and change:
BUCKET_NAME="my-custom-cdk-assets-${ACCOUNT_ID}-${REGION}"
```

### Issue: IAM Role Already Exists

```bash
# If roles exist from previous attempts, delete them:
aws iam delete-role --role-name cdk-hnb659fds-cfn-exec-role-ACCOUNT-REGION

# Or skip role creation in bootstrap-manual.sh
```

### Issue: ECR Repository Creation Fails

```bash
# Check ECR permissions
aws ecr describe-repositories

# If you can't create ECR repos, you can skip Docker support
# Edit infrastructure code to not use Docker containers
```

---

## Understanding the Hook

### What is AWS::EarlyValidation::ResourceExistenceCheck?

This CloudFormation hook validates:
1. Resources referenced in templates exist before deployment
2. Cross-stack references are valid
3. Resource properties are correct

### Why Does It Block CDK?

CDK bootstrap creates a **circular dependency**:
- Hook checks if resources exist
- Resources don't exist yet (first bootstrap)
- Hook fails the deployment
- Resources never get created

### Who Enables This Hook?

Usually enabled by:
- AWS Organizations (SCP policies)
- CloudFormation StackSets
- AWS Control Tower
- Custom governance frameworks

---

## Prevention for Future

### 1. Use Pre-Bootstrapped Accounts

Ask your organization to pre-bootstrap all AWS accounts:
```bash
# Admin runs once per account
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 2. Request Hook Exemption

Ask for CDKToolkit stack to be exempted from hooks:
```yaml
# In CloudFormation hook configuration
TargetFilters:
  - TargetType: STACK
    TargetNames:
      - CDKToolkit
    InvocationPoint: PRE_PROVISION
    FailureMode: WARN  # Don't fail, just warn
```

### 3. Use Infrastructure as Code Policies

Instead of hooks, use:
- AWS Config Rules (post-deployment validation)
- CloudFormation Guard (policy-as-code)
- Terraform Sentinel (if using Terraform)

---

## Verification Checklist

After bootstrap (manual or regular), verify:

- [ ] SSM parameter exists: `/cdk-bootstrap/hnb659fds/version`
- [ ] S3 bucket exists: `cdk-hnb659fds-assets-ACCOUNT-REGION`
- [ ] ECR repository exists: `cdk-hnb659fds-container-assets-ACCOUNT-REGION`
- [ ] IAM roles exist (5 roles):
  - `cdk-hnb659fds-cfn-exec-role-ACCOUNT-REGION`
  - `cdk-hnb659fds-deploy-role-ACCOUNT-REGION`
  - `cdk-hnb659fds-lookup-role-ACCOUNT-REGION`
  - `cdk-hnb659fds-file-publishing-role-ACCOUNT-REGION`
  - `cdk-hnb659fds-image-publishing-role-ACCOUNT-REGION`

```bash
# Run verification script
./verify-bootstrap.sh
```

---

## Quick Reference

| Problem | Solution | Command |
|---------|----------|---------|
| Hook blocks bootstrap | Manual bootstrap | `./bootstrap-manual.sh` |
| Permission denied | Contact admin | See Solution 2 |
| All solutions fail | Manual deployment | See Solution 4 |
| Need to verify | Check resources | `./verify-bootstrap.sh` |

---

## Success Indicators

You'll know bootstrap succeeded when:

1. ✅ No errors from bootstrap script
2. ✅ SSM parameter exists
3. ✅ S3 bucket created
4. ✅ `cdk deploy` works without bootstrap errors

---

## Next Steps After Successful Bootstrap

```bash
# 1. Deploy infrastructure
cd infrastructure
npm install
npm run build
cdk deploy --all

# 2. Or use the main deploy script
cd ..
./deploy.sh
```

---

## Getting Help

If none of these solutions work:

1. **Check AWS Service Health**: https://status.aws.amazon.com/
2. **AWS Support**: Open a case mentioning "CloudFormation Hook blocking CDK"
3. **CDK GitHub**: https://github.com/aws/aws-cdk/issues
4. **AWS Forums**: https://repost.aws/

---

## Summary

**Best Solution**: Run `./bootstrap-manual.sh` to bypass CloudFormation hooks

**If That Fails**: Contact AWS administrator to disable the hook or grant permissions

**Last Resort**: Deploy CloudFormation templates manually via AWS Console

**Your specific case**: Since you're in us-east-1 and still seeing the error, your account has organization-wide policies. Use manual bootstrap.

---

**Try manual bootstrap now:**
```bash
chmod +x bootstrap-manual.sh
./bootstrap-manual.sh
```

Good luck! 🚀
