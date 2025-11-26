# CI/CD Pipeline Guide - CI Alert System

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup](#setup)
- [How It Works](#how-it-works)
- [Making Changes](#making-changes)
- [Pipeline Stages](#pipeline-stages)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

The CI Alert System uses **AWS CodePipeline** with **GitHub** as the source to automatically build and deploy changes when you push code.

### What Gets Automated

✅ Infrastructure updates (CDK)  
✅ Lambda function deployments  
✅ Frontend deployments (S3)  
✅ Configuration changes  
✅ Dependency updates  

### Benefits

- **Zero manual deployment** - Just `git push`
- **Consistent deployments** - Same process every time
- **Fast feedback** - Know if deployment succeeds in 5-10 minutes
- **Rollback capability** - Easy to revert changes
- **Audit trail** - Every deployment tracked in GitHub

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│              harshasm123/CI-Alerts-System-Manual            │
└────────────────────────┬────────────────────────────────────┘
                         │ git push
                         │ (triggers webhook)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    AWS CodePipeline                          │
│                   CI-Alert-Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Stage 1: Source                                       │  │
│  │ - GitHub pulls latest code                            │  │
│  │ - Stores in S3 artifact bucket                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Stage 2: Build (Parallel)                             │  │
│  │                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐            │  │
│  │  │ BuildInfra      │  │ BuildLambdas    │            │  │
│  │  │ - npm install   │  │ - pip install   │            │  │
│  │  │ - cdk synth     │  │ - zip packages  │            │  │
│  │  └─────────────────┘  └─────────────────┘            │  │
│  │                                                        │  │
│  │  ┌─────────────────┐                                  │  │
│  │  │ BuildFrontend   │                                  │  │
│  │  │ - docker build  │                                  │  │
│  │  │ - push to ECR   │                                  │  │
│  │  └─────────────────┘                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Stage 3: Deploy                                       │  │
│  │ - CloudFormation changeset                            │  │
│  │ - Update CIAlertStack                                 │  │
│  │ - Deploy Lambda code                                  │  │
│  │ - Update S3 frontend                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│                    ✅ Success!                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup

### Prerequisites

1. **GitHub Repository**: `harshasm123/CI-Alerts-System-Manual`
2. **GitHub Personal Access Token** with scopes:
   - `repo` (Full control of private repositories)
   - `admin:repo_hook` (Full control of repository hooks)

### Step 1: Create GitHub Token

1. Go to: https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. Name: `CI-Alert-Pipeline`
4. Select scopes:
   - ✅ `repo`
   - ✅ `admin:repo_hook`
5. Click **Generate token**
6. **Copy the token** (you won't see it again!)

### Step 2: Store Token in AWS

```bash
# Store token in AWS Secrets Manager
aws secretsmanager create-secret \
  --name github-token \
  --secret-string "ghp_your_token_here" \
  --region us-east-1
```

### Step 3: Deploy CICD Stack

```bash
cd ~/CI-Alerts-System-Manual
./deploy.sh
# When prompted, enter 'y' and paste your GitHub token
```

Or deploy manually:

```bash
cd infrastructure
cdk deploy CIAlert-CICD
```

### Step 4: Verify Pipeline

```bash
# Check pipeline exists
aws codepipeline get-pipeline --name CI-Alert-Pipeline

# View pipeline in console
# https://console.aws.amazon.com/codesuite/codepipeline/pipelines/CI-Alert-Pipeline/view
```

---

## How It Works

### Trigger: Git Push

```bash
# You make changes
nano frontend/src/App.js

# Commit and push
git add .
git commit -m "Updated UI"
git push origin main
```

### Automatic Execution

1. **GitHub Webhook** → Notifies CodePipeline
2. **Source Stage** → Downloads code from GitHub
3. **Build Stage** → Builds infrastructure, Lambda, frontend
4. **Deploy Stage** → Updates AWS resources
5. **Notification** → Success/failure (if configured)

### Timeline

| Stage | Duration | What Happens |
|-------|----------|--------------|
| Source | 10-30s | Pull code from GitHub |
| Build Infrastructure | 1-2 min | CDK synth, generate CloudFormation |
| Build Lambdas | 30-60s | Install dependencies, zip packages |
| Build Frontend | 2-3 min | Docker build, push to ECR |
| Deploy | 3-5 min | CloudFormation update, Lambda deploy |
| **Total** | **5-10 min** | **Complete deployment** |

---

## Making Changes

### Scenario 1: Update Lambda Function

```bash
# Edit Lambda code
cd ~/CI-Alerts-System-Manual
nano lambdas/processing/processor.py

# Make your changes
# Example: Improve Bedrock prompt

# Commit and push
git add lambdas/processing/processor.py
git commit -m "Improved AI prompt for better insights"
git push origin main

# Pipeline automatically:
# 1. Detects push
# 2. Zips new Lambda code
# 3. Updates Lambda function
# 4. No downtime!
```

**Result**: Lambda function updated in ~5 minutes

### Scenario 2: Update Frontend

```bash
# Edit React component
cd ~/CI-Alerts-System-Manual
nano frontend/src/components/Dashboard.js

# Make your changes
# Example: Add new chart widget

# Commit and push
git add frontend/
git commit -m "Added analytics dashboard widget"
git push origin main

# Pipeline automatically:
# 1. Builds new frontend
# 2. Uploads to S3
# 3. CloudFront serves new version
```

**Result**: Frontend updated in ~7 minutes

### Scenario 3: Update Infrastructure

```bash
# Edit CDK stack
cd ~/CI-Alerts-System-Manual
nano infrastructure/lib/ci-alert-stack.ts

# Make your changes
# Example: Add new DynamoDB table

# Commit and push
git add infrastructure/
git commit -m "Added analytics table for user metrics"
git push origin main

# Pipeline automatically:
# 1. Runs CDK synth
# 2. Creates CloudFormation changeset
# 3. Deploys new resources
# 4. Updates stack
```

**Result**: Infrastructure updated in ~8 minutes

### Scenario 4: Update Multiple Components

```bash
# Edit multiple files
nano lambdas/api/insights_api.py
nano frontend/src/App.js
nano infrastructure/lib/ci-alert-stack.ts

# Commit all changes
git add .
git commit -m "Added new analytics feature across stack"
git push origin main

# Pipeline automatically:
# 1. Builds all components in parallel
# 2. Deploys in correct order
# 3. Updates everything atomically
```

**Result**: All components updated in ~10 minutes

---

## Pipeline Stages

### Stage 1: Source

**Purpose**: Fetch latest code from GitHub

**Actions**:
- GitHub source action
- Downloads repository
- Stores in S3 artifact bucket

**Output**: Source artifact (ZIP of repository)

**Duration**: 10-30 seconds

**Failure Scenarios**:
- Invalid GitHub token
- Repository not found
- Network issues

### Stage 2: Build

**Purpose**: Build all components in parallel

#### Build Infrastructure

**BuildSpec**:
```yaml
version: 0.2
phases:
  install:
    commands:
      - npm install -g aws-cdk
      - cd infrastructure
      - npm install
  build:
    commands:
      - npm run build
      - cdk synth
artifacts:
  base-directory: infrastructure/cdk.out
  files:
    - '**/*'
```

**Output**: CloudFormation templates

**Duration**: 1-2 minutes

#### Build Lambdas

**BuildSpec**:
```yaml
version: 0.2
phases:
  install:
    commands:
      - pip install -r lambdas/requirements.txt -t lambdas/
  build:
    commands:
      - cd lambdas
      - zip -r lambda-package.zip .
artifacts:
  files:
    - lambdas/lambda-package.zip
```

**Output**: Lambda deployment package

**Duration**: 30-60 seconds

#### Build Frontend

**BuildSpec**:
```yaml
version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REPO
  build:
    commands:
      - cd frontend
      - docker build -t ci-alert-frontend .
      - docker tag ci-alert-frontend:latest $ECR_REPO_URI:latest
  post_build:
    commands:
      - docker push $ECR_REPO_URI:latest
```

**Output**: Docker image in ECR

**Duration**: 2-3 minutes

### Stage 3: Deploy

**Purpose**: Deploy to AWS

**Actions**:
- CloudFormation CreateUpdateStack
- Updates CIAlertStack
- Deploys Lambda code
- Updates S3 frontend

**Duration**: 3-5 minutes

**Rollback**: Automatic on failure

---

## Monitoring

### AWS Console

**CodePipeline Dashboard**:
```
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/CI-Alert-Pipeline/view
```

**View**:
- Current execution status
- Stage progress
- Build logs
- Deployment history

### CLI Commands

**Check pipeline status**:
```bash
aws codepipeline get-pipeline-state --name CI-Alert-Pipeline
```

**List recent executions**:
```bash
aws codepipeline list-pipeline-executions \
  --pipeline-name CI-Alert-Pipeline \
  --max-items 10
```

**Get execution details**:
```bash
aws codepipeline get-pipeline-execution \
  --pipeline-name CI-Alert-Pipeline \
  --pipeline-execution-id <execution-id>
```

**View build logs**:
```bash
# Get build ID from pipeline execution
aws codebuild batch-get-builds --ids <build-id>

# Stream logs
aws logs tail /aws/codebuild/CI-Alert-InfraBuild --follow
```

### Notifications (Optional)

**Setup SNS notifications**:
```bash
# Create SNS topic
aws sns create-topic --name ci-alert-pipeline-notifications

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:ci-alert-pipeline-notifications \
  --protocol email \
  --notification-endpoint your-email@example.com

# Add to pipeline (in cicd-stack.ts)
pipeline.onStateChange('PipelineStateChange', {
  target: new targets.SnsTopic(notificationTopic),
});
```

---

## Troubleshooting

### Issue: Pipeline Fails at Source Stage

**Error**: `Could not access GitHub repository`

**Cause**: Invalid or expired GitHub token

**Fix**:
```bash
# Update token in Secrets Manager
aws secretsmanager update-secret \
  --secret-id github-token \
  --secret-string "ghp_new_token_here"

# Retry pipeline
aws codepipeline start-pipeline-execution --name CI-Alert-Pipeline
```

### Issue: Build Stage Fails

**Error**: `npm install failed` or `pip install failed`

**Cause**: Dependency issues or network problems

**Fix**:
```bash
# Check build logs
aws logs tail /aws/codebuild/CI-Alert-InfraBuild --follow

# Common fixes:
# 1. Update package.json/requirements.txt
# 2. Clear npm cache in buildspec
# 3. Use specific dependency versions
```

### Issue: Deploy Stage Fails

**Error**: `CloudFormation stack update failed`

**Cause**: Resource conflicts or permission issues

**Fix**:
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name CIAlertStack \
  --max-items 20

# Manual rollback if needed
aws cloudformation cancel-update-stack --stack-name CIAlertStack

# Fix issue and retry
git commit --amend
git push --force origin main
```

### Issue: Pipeline Stuck

**Error**: Pipeline execution doesn't start

**Cause**: Webhook not configured or GitHub connection issue

**Fix**:
```bash
# Check webhook exists
aws codepipeline list-webhooks

# Recreate webhook
aws codepipeline register-webhook-with-third-party \
  --webhook-name CI-Alert-Webhook

# Or redeploy CICD stack
cd infrastructure
cdk deploy CIAlert-CICD --force
```

---

## Best Practices

### 1. Branch Strategy

**Use feature branches**:
```bash
# Create feature branch
git checkout -b feature/new-dashboard

# Make changes
nano frontend/src/Dashboard.js

# Push to feature branch
git push origin feature/new-dashboard

# Merge to main when ready
git checkout main
git merge feature/new-dashboard
git push origin main  # Triggers pipeline
```

### 2. Commit Messages

**Use conventional commits**:
```bash
git commit -m "feat: add analytics dashboard"
git commit -m "fix: resolve API timeout issue"
git commit -m "chore: update dependencies"
git commit -m "docs: update README"
```

### 3. Testing Before Push

**Test locally**:
```bash
# Test infrastructure
cd infrastructure
npm run build
cdk synth

# Test Lambda
cd ../lambdas
python -m pytest

# Test frontend
cd ../frontend
npm test
```

### 4. Small, Incremental Changes

**Good**:
```bash
git commit -m "feat: add user profile endpoint"
git push

git commit -m "feat: add profile UI component"
git push

git commit -m "feat: integrate profile API with UI"
git push
```

**Bad**:
```bash
# One huge commit with everything
git commit -m "Added entire user profile feature"
git push
# If this fails, hard to debug
```

### 5. Monitor Deployments

**Always check**:
```bash
# After pushing
git push origin main

# Watch pipeline
watch -n 5 'aws codepipeline get-pipeline-state --name CI-Alert-Pipeline'

# Or open console
# https://console.aws.amazon.com/codesuite/codepipeline/
```

### 6. Rollback Strategy

**If deployment fails**:
```bash
# Option 1: Revert commit
git revert HEAD
git push origin main

# Option 2: Force push previous commit
git reset --hard HEAD~1
git push --force origin main

# Option 3: Manual CloudFormation rollback
aws cloudformation cancel-update-stack --stack-name CIAlertStack
```

---

## Pipeline Configuration

### Customize Pipeline

**Edit**: `infrastructure/lib/cicd-stack.ts`

**Change GitHub repo**:
```typescript
const githubOwner = 'your-username';
const githubRepo = 'your-repo-name';
const githubBranch = 'main';
```

**Add approval stage**:
```typescript
{
  stageName: 'Approval',
  actions: [
    new codepipeline_actions.ManualApprovalAction({
      actionName: 'ManualApproval',
      notificationTopic: approvalTopic,
    }),
  ],
}
```

**Add testing stage**:
```typescript
{
  stageName: 'Test',
  actions: [
    new codepipeline_actions.CodeBuildAction({
      actionName: 'RunTests',
      project: testProject,
      input: sourceOutput,
    }),
  ],
}
```

### Deploy Changes

```bash
cd infrastructure
cdk deploy CIAlert-CICD
```

---

## Cost

**Monthly CI/CD costs** (estimated):

| Service | Usage | Cost |
|---------|-------|------|
| CodePipeline | 1 active pipeline | $1.00 |
| CodeBuild | ~100 builds/month | $5.00 |
| S3 (artifacts) | 10 GB storage | $0.23 |
| CloudWatch Logs | 5 GB logs | $2.50 |
| **Total** | | **~$8.73/month** |

**Free tier**:
- CodePipeline: 1 free pipeline/month
- CodeBuild: 100 build minutes/month free

---

## Summary

### What You Do
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### What CI/CD Does
1. ✅ Pulls code from GitHub
2. ✅ Builds infrastructure (CDK)
3. ✅ Builds Lambda packages
4. ✅ Builds frontend (Docker)
5. ✅ Deploys to AWS
6. ✅ Updates all stacks
7. ✅ Verifies deployment
8. ✅ Sends notifications

### Result
- **Zero manual deployment**
- **5-10 minute deployments**
- **Consistent and reliable**
- **Full audit trail**
- **Easy rollbacks**

---

## Additional Resources

- **AWS CodePipeline Docs**: https://docs.aws.amazon.com/codepipeline/
- **AWS CodeBuild Docs**: https://docs.aws.amazon.com/codebuild/
- **GitHub Webhooks**: https://docs.github.com/webhooks
- **CDK Pipelines**: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html

---

**Questions?** Check [QUICKSTART.md](QUICKSTART.md) or [DOCS.md](DOCS.md)
