# Deployment Strategies for CI Alert System

## 🎯 Overview

This document covers deployment strategies, patterns, and best practices for the CI Alert System across different team sizes and organizational needs.

---

## 📋 Deployment Strategy Matrix

| Strategy | Team Size | Complexity | Downtime | Cost | Use Case |
|----------|-----------|------------|----------|------|----------|
| **Big Bang** | 5-10 | Low | 2-4 hours | Low | Initial deployment |
| **Blue-Green** | 10-25 | Medium | 0 minutes | Medium | Production updates |
| **Canary** | 25-50 | High | 0 minutes | Medium | Risk mitigation |
| **Rolling** | 50-100+ | High | 0 minutes | High | Enterprise scale |
| **Feature Flags** | Any | Medium | 0 minutes | Low | A/B testing |

---

## 🚀 Strategy 1: Big Bang Deployment

### Overview
Deploy entire system at once. Best for initial deployment or small teams.

### When to Use
- ✅ Initial deployment (no existing system)
- ✅ Small teams (5-10 users)
- ✅ Development/staging environments
- ✅ Low-risk updates
- ✅ Scheduled maintenance windows

### Architecture
```
Old System: [None]
                ↓
         [Deploy All]
                ↓
New System: [CI Alert System v1.0]
```

### Implementation Steps

**1. Pre-Deployment (1 hour)**
```bash
# Verify prerequisites
aws configure list
node --version  # Should be 20+
docker --version

# Run pre-deployment checks
bash scripts/pre-deploy-check.sh

# Backup existing data (if any)
bash scripts/backup-data.sh
```

**2. Deployment (1-2 hours)**
```bash
# Deploy all stacks
./scripts/production-deploy.sh production admin@company.com

# Verify deployment
bash scripts/verify-deployment.sh
```

**3. Post-Deployment (30 minutes)**
```bash
# Configure users
bash scripts/setup-users.sh users.csv

# Run smoke tests
bash "shell scripts/test.sh" system

# Enable monitoring
bash scripts/enable-monitoring.sh
```

### Pros & Cons

**Advantages:**
- ✅ Simple and straightforward
- ✅ Fast deployment (2-3 hours total)
- ✅ Easy to understand and execute
- ✅ Low operational complexity
- ✅ No version conflicts

**Disadvantages:**
- ⚠️ Downtime required (2-4 hours)
- ⚠️ High risk (all or nothing)
- ⚠️ Difficult rollback
- ⚠️ No gradual testing
- ⚠️ Users affected simultaneously

### Rollback Strategy
```bash
# If deployment fails
aws cloudformation delete-stack --stack-name CIAlertStack
aws cloudformation wait stack-delete-complete --stack-name CIAlertStack

# Restore from backup
bash scripts/restore-backup.sh backup-2024-01-15.tar.gz
```

### Success Metrics
- Deployment completes without errors
- All health checks pass
- Users can login and access dashboard
- API response time < 2 seconds

---

## 🔵🟢 Strategy 2: Blue-Green Deployment

### Overview
Run two identical environments (Blue = current, Green = new). Switch traffic instantly.

### When to Use
- ✅ Production updates (10-25 users)
- ✅ Zero-downtime requirement
- ✅ Easy rollback needed
- ✅ Confidence in new version
- ✅ Sufficient budget (2x infrastructure temporarily)

### Architecture
```
Users → Route 53
         ↓
    [Blue Environment]  ← Currently serving traffic
         ↓
    [Green Environment] ← New version deployed
         ↓
    Switch DNS (instant)
         ↓
    [Green Environment] ← Now serving traffic
         ↓
    [Blue Environment]  ← Kept for rollback (24 hours)
```

### Implementation Steps

**1. Deploy Green Environment (1 hour)**
```bash
# Set environment variable
export DEPLOYMENT_COLOR=green

# Deploy new version to green
cdk deploy CIAlertStack-Green \
  --parameters Environment=green \
  --parameters Version=v2.0

# Verify green environment
curl https://green.ci-alert.company.com/health
```

**2. Test Green Environment (30 minutes)**
```bash
# Run comprehensive tests
bash scripts/test-environment.sh green

# Smoke test with real users (5 beta testers)
bash scripts/beta-test.sh green beta-users.csv

# Monitor for 15 minutes
bash scripts/monitor-environment.sh green --duration 15m
```

**3. Switch Traffic (5 minutes)**
```bash
# Update Route 53 to point to green
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://switch-to-green.json

# Verify traffic switch
bash scripts/verify-traffic.sh green
```

**4. Monitor & Cleanup (24 hours)**
```bash
# Monitor green for 24 hours
bash scripts/monitor-environment.sh green --duration 24h

# If successful, decommission blue
aws cloudformation delete-stack --stack-name CIAlertStack-Blue

# If issues, rollback to blue
bash scripts/rollback-to-blue.sh
```

### Configuration Files

**switch-to-green.json:**
```json
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "ci-alert.company.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z1234567890ABC",
        "DNSName": "green-alb-123456.us-east-1.elb.amazonaws.com",
        "EvaluateTargetHealth": true
      }
    }
  }]
}
```

### Pros & Cons

**Advantages:**
- ✅ Zero downtime
- ✅ Instant rollback (switch DNS back)
- ✅ Full testing before switch
- ✅ Low risk
- ✅ User experience unaffected

**Disadvantages:**
- ⚠️ 2x infrastructure cost (temporarily)
- ⚠️ Database migration complexity
- ⚠️ DNS propagation delay (5-60 seconds)
- ⚠️ More complex setup
- ⚠️ Requires traffic switching mechanism

### Rollback Strategy
```bash
# Instant rollback (< 1 minute)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://rollback-to-blue.json

# Verify rollback
bash scripts/verify-traffic.sh blue
```

### Success Metrics
- Green environment passes all tests
- Traffic switch completes in < 60 seconds
- No increase in error rates
- API response time unchanged
- Zero user complaints

### Cost Analysis
- **During deployment:** 2x infrastructure cost (2-4 hours)
- **After deployment:** Normal cost
- **Total extra cost:** $10-50 (depending on configuration)

---

## 🐤 Strategy 3: Canary Deployment

### Overview
Gradually roll out to small percentage of users, monitor, then expand.

### When to Use
- ✅ Large teams (25-50 users)
- ✅ High-risk changes
- ✅ Need gradual validation
- ✅ A/B testing requirements
- ✅ Performance testing under load

### Architecture
```
Users (100%)
    ↓
Load Balancer
    ↓
    ├─ 95% → [Stable Version v1.0]
    └─ 5%  → [Canary Version v2.0]
         ↓
    Monitor metrics
         ↓
    If good: 10% → 25% → 50% → 100%
    If bad: Rollback to 0%
```

### Implementation Steps

**Phase 1: Deploy Canary (5% traffic)**
```bash
# Deploy canary version
cdk deploy CIAlertStack-Canary \
  --parameters TrafficWeight=5 \
  --parameters Version=v2.0

# Configure ALB target groups
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions file://canary-5-percent.json
```

**Phase 2: Monitor (2 hours)**
```bash
# Monitor canary metrics
bash scripts/monitor-canary.sh --duration 2h

# Compare metrics: canary vs stable
bash scripts/compare-metrics.sh canary stable

# Check for errors
aws logs tail /aws/lambda/CIAlertStack-Canary --follow
```

**Phase 3: Gradual Rollout**
```bash
# If metrics good, increase to 10%
bash scripts/increase-canary.sh 10

# Monitor for 1 hour
bash scripts/monitor-canary.sh --duration 1h

# Continue: 25% → 50% → 100%
bash scripts/increase-canary.sh 25
bash scripts/monitor-canary.sh --duration 1h

bash scripts/increase-canary.sh 50
bash scripts/monitor-canary.sh --duration 1h

bash scripts/increase-canary.sh 100
```

**Phase 4: Finalize**
```bash
# Promote canary to stable
bash scripts/promote-canary.sh

# Decommission old version
aws cloudformation delete-stack --stack-name CIAlertStack-Old
```

### Canary Metrics to Monitor

**Critical Metrics:**
- Error rate (should be < 1%)
- Latency p95 (should be < 500ms)
- API success rate (should be > 99%)
- User engagement (should be unchanged)

**Automated Decision Rules:**
```yaml
Rollback if:
  - Error rate > 5%
  - Latency p95 > 1000ms
  - API success rate < 95%
  - User complaints > 3

Proceed if:
  - Error rate < 1%
  - Latency p95 < 500ms
  - API success rate > 99%
  - No user complaints
```

### Configuration Files

**canary-5-percent.json:**
```json
[{
  "Type": "forward",
  "ForwardConfig": {
    "TargetGroups": [
      {
        "TargetGroupArn": "arn:aws:elasticloadbalancing:...:stable",
        "Weight": 95
      },
      {
        "TargetGroupArn": "arn:aws:elasticloadbalancing:...:canary",
        "Weight": 5
      }
    ]
  }
}]
```

### Pros & Cons

**Advantages:**
- ✅ Lowest risk (only 5% affected initially)
- ✅ Real-world validation
- ✅ Gradual rollout
- ✅ Easy to stop/rollback
- ✅ Performance testing under real load

**Disadvantages:**
- ⚠️ Complex setup
- ⚠️ Longer deployment time (4-8 hours)
- ⚠️ Requires sophisticated monitoring
- ⚠️ Database migration challenges
- ⚠️ Higher operational overhead

### Rollback Strategy
```bash
# Instant rollback (set canary to 0%)
bash scripts/rollback-canary.sh

# Verify all traffic on stable
bash scripts/verify-traffic.sh stable
```

### Success Metrics
- Canary error rate ≤ stable error rate
- Canary latency ≤ stable latency
- No increase in user complaints
- Successful progression: 5% → 10% → 25% → 50% → 100%

---

## 🔄 Strategy 4: Rolling Deployment

### Overview
Update instances one at a time or in small batches. Best for large-scale deployments.

### When to Use
- ✅ Enterprise teams (50-100+ users)
- ✅ High availability requirement
- ✅ Large number of instances
- ✅ Continuous deployment
- ✅ Kubernetes/ECS environments

### Architecture
```
10 ECS Tasks Running v1.0
    ↓
Update 2 tasks to v2.0 (20%)
    ↓
Wait for health checks
    ↓
Update 2 more tasks (40%)
    ↓
Continue until all updated (100%)
```

### Implementation Steps

**1. Configure Rolling Update**
```yaml
# ECS Service Configuration
DeploymentConfiguration:
  MaximumPercent: 200
  MinimumHealthyPercent: 100
  DeploymentCircuitBreaker:
    Enable: true
    Rollback: true

UpdateConfig:
  MaxBatchSize: 2
  MinHealthyPercent: 80
  PauseTime: PT5M  # 5 minutes between batches
```

**2. Deploy Update**
```bash
# Update ECS service with new task definition
aws ecs update-service \
  --cluster ci-alert-cluster \
  --service ci-alert-service \
  --task-definition ci-alert-task:v2 \
  --deployment-configuration file://rolling-config.json

# Monitor deployment
aws ecs wait services-stable \
  --cluster ci-alert-cluster \
  --services ci-alert-service
```

**3. Monitor Progress**
```bash
# Watch deployment progress
watch -n 10 'aws ecs describe-services \
  --cluster ci-alert-cluster \
  --services ci-alert-service \
  --query "services[0].deployments"'

# Monitor health checks
bash scripts/monitor-rolling-deployment.sh
```

### Deployment Timeline

**For 10 ECS Tasks:**
- Batch 1 (Tasks 1-2): 0-5 minutes
- Health check: 5-10 minutes
- Batch 2 (Tasks 3-4): 10-15 minutes
- Health check: 15-20 minutes
- Batch 3 (Tasks 5-6): 20-25 minutes
- Health check: 25-30 minutes
- Batch 4 (Tasks 7-8): 30-35 minutes
- Health check: 35-40 minutes
- Batch 5 (Tasks 9-10): 40-45 minutes
- Final verification: 45-50 minutes

**Total Time:** 50 minutes

### Pros & Cons

**Advantages:**
- ✅ Zero downtime
- ✅ Gradual rollout
- ✅ Automatic rollback on failure
- ✅ No extra infrastructure cost
- ✅ Built-in health checks

**Disadvantages:**
- ⚠️ Slower deployment (45-60 minutes)
- ⚠️ Version mixing during deployment
- ⚠️ Complex monitoring
- ⚠️ Requires orchestration platform
- ⚠️ Database migration complexity

### Rollback Strategy
```bash
# Automatic rollback (if circuit breaker enabled)
# Manual rollback
aws ecs update-service \
  --cluster ci-alert-cluster \
  --service ci-alert-service \
  --task-definition ci-alert-task:v1 \
  --force-new-deployment
```

### Success Metrics
- All tasks updated successfully
- No failed health checks
- Error rate unchanged
- Latency unchanged
- Deployment completes in < 60 minutes

---

## 🚩 Strategy 5: Feature Flags

### Overview
Deploy code with features disabled, enable gradually via configuration.

### When to Use
- ✅ A/B testing
- ✅ Gradual feature rollout
- ✅ Risk mitigation
- ✅ User-specific features
- ✅ Beta testing

### Architecture
```
Code Deployed with Feature Flags
    ↓
Feature Flag Service (LaunchDarkly/AWS AppConfig)
    ↓
Enable for:
  - 5% of users (beta)
  - Specific users (internal team)
  - Specific companies (enterprise)
    ↓
Monitor and adjust in real-time
```

### Implementation

**1. Add Feature Flag Library**
```javascript
// frontend/src/featureFlags.js
import { LDClient } from 'launchdarkly-js-client-sdk';

const client = LDClient.initialize('YOUR_CLIENT_ID', {
  key: userId,
  email: userEmail
});

export const isFeatureEnabled = async (flagKey) => {
  await client.waitForInitialization();
  return client.variation(flagKey, false);
};
```

**2. Wrap Features**
```javascript
// frontend/src/App.js
import { isFeatureEnabled } from './featureFlags';

function App() {
  const [showNewChat, setShowNewChat] = useState(false);

  useEffect(() => {
    isFeatureEnabled('new-chat-interface').then(setShowNewChat);
  }, []);

  return (
    <div>
      {showNewChat ? <NewChatInterface /> : <OldChatInterface />}
    </div>
  );
}
```

**3. Configure Flags**
```yaml
# Feature Flag Configuration
new-chat-interface:
  enabled: true
  targeting:
    - rule: "Beta Users"
      percentage: 5
      users: ["user1@company.com", "user2@company.com"]
    - rule: "Enterprise Customers"
      companies: ["Pfizer", "Novartis"]
    - rule: "Gradual Rollout"
      percentage: 10  # Increase gradually
```

**4. Monitor & Adjust**
```bash
# Monitor feature usage
bash scripts/monitor-feature-flag.sh new-chat-interface

# Increase rollout
bash scripts/update-feature-flag.sh new-chat-interface --percentage 25

# Disable if issues
bash scripts/disable-feature-flag.sh new-chat-interface
```

### Feature Flag Examples

**Example 1: Dual-Model AI (Cost Optimization)**
```python
# lambdas/processing/processor.py
import boto3
import os

def get_model_for_task(task_type, user_tier):
    # Feature flag: use-haiku-model
    use_haiku = get_feature_flag('use-haiku-model', user_tier)
    
    if task_type == 'summary' and use_haiku:
        return 'anthropic.claude-3-5-haiku-20241022'
    else:
        return 'anthropic.claude-3-5-sonnet-20250106-v1:0'
```

**Example 2: New RAG Architecture**
```python
# lambdas/bedrock-agent/action_handler.py
def search_knowledge_base(query):
    # Feature flag: new-rag-architecture
    use_new_rag = get_feature_flag('new-rag-architecture')
    
    if use_new_rag:
        return new_hybrid_search(query)  # Vector + keyword
    else:
        return legacy_vector_search(query)  # Vector only
```

**Example 3: Enhanced Monitoring**
```javascript
// frontend/src/Dashboard.js
const Dashboard = () => {
  const showAdvancedMetrics = useFeatureFlag('advanced-metrics');
  
  return (
    <div>
      <BasicMetrics />
      {showAdvancedMetrics && <AdvancedMetrics />}
    </div>
  );
};
```

### Pros & Cons

**Advantages:**
- ✅ Deploy anytime, enable later
- ✅ Instant enable/disable (no deployment)
- ✅ User-specific targeting
- ✅ A/B testing built-in
- ✅ Gradual rollout
- ✅ Easy rollback (just disable flag)

**Disadvantages:**
- ⚠️ Code complexity (if/else everywhere)
- ⚠️ Technical debt (old code paths remain)
- ⚠️ Testing complexity (test all combinations)
- ⚠️ Additional service dependency
- ⚠️ Cost of feature flag service

### Rollback Strategy
```bash
# Instant rollback (disable flag)
bash scripts/disable-feature-flag.sh new-chat-interface

# No deployment needed, takes effect immediately
```

### Success Metrics
- Feature adoption rate
- Error rate comparison (flag on vs off)
- User feedback scores
- Performance impact
- Conversion rate (if applicable)

---

## 📊 Strategy Comparison

| Criteria | Big Bang | Blue-Green | Canary | Rolling | Feature Flags |
|----------|----------|------------|--------|---------|---------------|
| **Downtime** | 2-4 hours | 0 | 0 | 0 | 0 |
| **Risk** | High | Low | Very Low | Low | Very Low |
| **Complexity** | Low | Medium | High | High | Medium |
| **Rollback Time** | Hours | Seconds | Seconds | Minutes | Instant |
| **Cost** | Low | Medium | Medium | Low | Low |
| **Deployment Time** | 2-3 hours | 1-2 hours | 4-8 hours | 45-60 min | 1-2 hours |
| **Testing** | Limited | Full | Gradual | Gradual | Gradual |
| **Best For** | Initial | Updates | High-risk | Enterprise | Features |

---

## 🎯 Recommended Strategy by Team Size

### Small Team (5-10 users)
**Primary:** Big Bang  
**Secondary:** Feature Flags (for A/B testing)

**Rationale:**
- Simple deployment
- Low user impact
- Fast iteration
- Cost-effective

---

### Medium Team (10-25 users)
**Primary:** Blue-Green  
**Secondary:** Feature Flags

**Rationale:**
- Zero downtime needed
- Easy rollback
- Production-grade
- Reasonable cost

---

### Large Team (25-50 users)
**Primary:** Canary  
**Secondary:** Feature Flags

**Rationale:**
- Risk mitigation critical
- Gradual validation needed
- Real-world testing
- High availability required

---

### Enterprise Team (50-100+ users)
**Primary:** Rolling + Canary  
**Secondary:** Feature Flags

**Rationale:**
- Maximum reliability
- Continuous deployment
- Sophisticated monitoring
- Global user base

---

## 🔧 Implementation Guide

### Step 1: Choose Strategy

**Decision Tree:**
```
Is this initial deployment?
├─ YES → Big Bang
└─ NO → Continue

Do you have < 10 users?
├─ YES → Big Bang or Blue-Green
└─ NO → Continue

Is this a high-risk change?
├─ YES → Canary
└─ NO → Continue

Do you have > 50 users?
├─ YES → Rolling + Canary
└─ NO → Blue-Green
```

### Step 2: Prepare Infrastructure

**For Blue-Green:**
```bash
# Create blue environment
cdk deploy CIAlertStack-Blue

# Create green environment
cdk deploy CIAlertStack-Green

# Configure Route 53
bash scripts/setup-blue-green.sh
```

**For Canary:**
```bash
# Deploy stable version
cdk deploy CIAlertStack-Stable

# Deploy canary version
cdk deploy CIAlertStack-Canary --parameters TrafficWeight=5

# Configure monitoring
bash scripts/setup-canary-monitoring.sh
```

**For Rolling:**
```bash
# Configure ECS service
bash scripts/configure-rolling-deployment.sh

# Set deployment parameters
bash scripts/set-rolling-params.sh --batch-size 2 --pause-time 5m
```

**For Feature Flags:**
```bash
# Install feature flag service
npm install launchdarkly-js-client-sdk

# Configure flags
bash scripts/setup-feature-flags.sh

# Create initial flags
bash scripts/create-flags.sh flags-config.yaml
```

### Step 3: Execute Deployment

**Pre-Deployment Checklist:**
- [ ] Backup current data
- [ ] Run pre-deployment tests
- [ ] Notify users (if downtime expected)
- [ ] Prepare rollback plan
- [ ] Set up monitoring dashboards
- [ ] Have team on standby

**Deployment Execution:**
```bash
# Run deployment script for chosen strategy
bash scripts/deploy-${STRATEGY}.sh

# Monitor deployment
bash scripts/monitor-deployment.sh --strategy ${STRATEGY}

# Verify deployment
bash scripts/verify-deployment.sh
```

**Post-Deployment:**
- [ ] Run smoke tests
- [ ] Check error rates
- [ ] Verify user access
- [ ] Monitor for 24 hours
- [ ] Collect user feedback
- [ ] Document lessons learned

---

## 📈 Monitoring & Metrics

### Key Metrics to Track

**During Deployment:**
- Error rate (should be < 1%)
- Latency p50, p95, p99
- API success rate (should be > 99%)
- Active users count
- Database connection pool
- Memory/CPU usage

**After Deployment:**
- User engagement (daily active users)
- Feature adoption rate
- Cost per request
- Query response time
- User satisfaction scores

### Monitoring Dashboard

```yaml
CloudWatch Dashboard:
  - API Gateway:
      - Request count
      - Error rate (4xx, 5xx)
      - Latency (p50, p95, p99)
  
  - Lambda:
      - Invocations
      - Errors
      - Duration
      - Concurrent executions
  
  - DynamoDB:
      - Read/Write capacity
      - Throttled requests
      - Latency
  
  - ECS:
      - Task count
      - CPU utilization
      - Memory utilization
      - Health check status
  
  - Custom Metrics:
      - Cost per query
      - User engagement
      - Feature flag usage
```

### Alerting Rules

```yaml
Critical Alerts (PagerDuty):
  - Error rate > 5% for 5 minutes
  - API latency p95 > 2000ms for 5 minutes
  - Service unavailable
  - Database connection failures

Warning Alerts (Email):
  - Error rate > 2% for 10 minutes
  - API latency p95 > 1000ms for 10 minutes
  - Cost increase > 50%
  - Unusual traffic patterns

Info Alerts (Slack):
  - Deployment started
  - Deployment completed
  - Feature flag changed
  - New users added
```

---

## 🎓 Best Practices

### 1. Always Have a Rollback Plan
```bash
# Document rollback steps BEFORE deployment
echo "Rollback Plan:" > rollback-plan.md
echo "1. Run: bash scripts/rollback.sh" >> rollback-plan.md
echo "2. Verify: bash scripts/verify-rollback.sh" >> rollback-plan.md
echo "3. Notify users" >> rollback-plan.md
```

### 2. Test in Staging First
```bash
# Deploy to staging
./scripts/production-deploy.sh staging test@company.com

# Run full test suite
bash "shell scripts/test.sh" system

# Load test
bash scripts/load-test.sh --users 100 --duration 10m
```

### 3. Deploy During Low-Traffic Hours
- Best time: 2-4 AM local time
- Avoid: Monday mornings, Friday afternoons
- Consider: Global team timezones

### 4. Communicate with Users
```bash
# Send pre-deployment notification (24 hours before)
bash scripts/notify-users.sh --template pre-deployment

# Send deployment notification (during deployment)
bash scripts/notify-users.sh --template deployment-in-progress

# Send completion notification (after deployment)
bash scripts/notify-users.sh --template deployment-complete
```

### 5. Monitor Closely After Deployment
```bash
# Monitor for first 24 hours
bash scripts/monitor-deployment.sh --duration 24h --alert-threshold high

# Daily check for first week
bash scripts/daily-health-check.sh
```

---

## 🚨 Troubleshooting

### Deployment Fails

**Symptom:** CloudFormation stack fails to create

**Solution:**
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name CIAlertStack

# Check logs
aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction

# Rollback
aws cloudformation delete-stack --stack-name CIAlertStack
```

### High Error Rate After Deployment

**Symptom:** Error rate > 5% after deployment

**Solution:**
```bash
# Immediate rollback
bash scripts/rollback.sh

# Investigate errors
aws logs filter-pattern "ERROR" --log-group-name /aws/lambda/CIAlertStack

# Fix and redeploy
```

### Slow Performance After Deployment

**Symptom:** API latency > 2 seconds

**Solution:**
```bash
# Check Lambda cold starts
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Duration

# Enable provisioned concurrency
bash scripts/enable-provisioned-concurrency.sh

# Optimize code
bash scripts/analyze-performance.sh
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Choose deployment strategy
- [ ] Backup current data
- [ ] Test in staging environment
- [ ] Prepare rollback plan
- [ ] Set up monitoring
- [ ] Notify users (if needed)
- [ ] Schedule deployment window
- [ ] Assign team roles

### During Deployment
- [ ] Execute deployment script
- [ ] Monitor metrics in real-time
- [ ] Watch for errors/warnings
- [ ] Verify health checks
- [ ] Test critical paths
- [ ] Document any issues

### Post-Deployment
- [ ] Run smoke tests
- [ ] Verify all features working
- [ ] Check error rates
- [ ] Monitor for 24 hours
- [ ] Collect user feedback
- [ ] Update documentation
- [ ] Conduct retrospective
- [ ] Plan next deployment

---

## 📚 Additional Resources

### Scripts
- `scripts/production-deploy.sh` - Main deployment script
- `scripts/rollback.sh` - Rollback to previous version
- `scripts/monitor-deployment.sh` - Monitor deployment progress
- `scripts/verify-deployment.sh` - Verify deployment success

### Documentation
- `QUICKSTART.md` - Quick deployment guide
- `README.md` - System overview
- `DEPLOYMENT_SIZING.md` - Team size configurations
- `TROUBLESHOOTING.md` - Common issues and solutions

### Tools
- AWS CloudFormation - Infrastructure as code
- AWS CDK - Infrastructure deployment
- CloudWatch - Monitoring and alerting
- Route 53 - DNS management
- ECS - Container orchestration

---

**Recommended for most teams: Blue-Green deployment with Feature Flags for gradual rollout**


---

## 🧪 Strategy 6: A/B Testing Deployment

### Overview
Deploy multiple versions simultaneously and compare performance, user behavior, and business metrics.

### When to Use
- ✅ Testing new features or UX changes
- ✅ Comparing AI model performance (Haiku vs Sonnet)
- ✅ Optimizing conversion rates
- ✅ Validating product hypotheses
- ✅ Data-driven decision making

### Architecture
```
Users (100%)
    ↓
Load Balancer with User Segmentation
    ↓
    ├─ 50% → [Version A: Claude Haiku]
    └─ 50% → [Version B: Claude Sonnet]
         ↓
    Track Metrics:
      - Response quality
      - User satisfaction
      - Cost per query
      - Engagement rate
         ↓
    Statistical Analysis
         ↓
    Choose Winner
```

### Implementation

**1. Define Experiment**
```yaml
# experiments/dual-model-test.yaml
experiment:
  name: "Haiku vs Sonnet Performance"
  hypothesis: "Haiku provides 90% quality at 50% cost"
  duration: 14 days
  traffic_split:
    variant_a: 50  # Haiku
    variant_b: 50  # Sonnet
  
  metrics:
    primary:
      - user_satisfaction_score
      - cost_per_query
    secondary:
      - response_time
      - engagement_rate
      - daily_active_users
  
  success_criteria:
    - satisfaction_score_diff < 5%
    - cost_reduction > 20%
    - response_time_diff < 500ms
```

**2. Implement User Segmentation**
```python
# lambdas/processing/ab_test.py
import hashlib
import os

def get_experiment_variant(user_id, experiment_name):
    """
    Consistent hash-based assignment
    Same user always gets same variant
    """
    hash_input = f"{user_id}:{experiment_name}"
    hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
    
    # 50/50 split
    return 'variant_a' if hash_value % 2 == 0 else 'variant_b'

def get_model_for_user(user_id, task_type):
    """
    Route user to appropriate model based on A/B test
    """
    variant = get_experiment_variant(user_id, 'dual-model-test')
    
    if variant == 'variant_a':
        # Haiku for all tasks
        return 'anthropic.claude-3-5-haiku-20241022'
    else:
        # Sonnet for all tasks
        return 'anthropic.claude-3-5-sonnet-20250106-v1:0'
```

**3. Track Metrics**
```python
# lambdas/processing/metrics_tracker.py
import boto3
from datetime import datetime

cloudwatch = boto3.client('cloudwatch')

def track_ab_test_metrics(user_id, variant, metrics):
    """
    Send metrics to CloudWatch for analysis
    """
    cloudwatch.put_metric_data(
        Namespace='CIAlert/ABTest',
        MetricData=[
            {
                'MetricName': 'ResponseTime',
                'Value': metrics['response_time'],
                'Unit': 'Milliseconds',
                'Dimensions': [
                    {'Name': 'Variant', 'Value': variant},
                    {'Name': 'Experiment', 'Value': 'dual-model-test'}
                ]
            },
            {
                'MetricName': 'CostPerQuery',
                'Value': metrics['cost'],
                'Unit': 'None',
                'Dimensions': [
                    {'Name': 'Variant', 'Value': variant}
                ]
            },
            {
                'MetricName': 'UserSatisfaction',
                'Value': metrics['satisfaction_score'],
                'Unit': 'None',
                'Dimensions': [
                    {'Name': 'Variant', 'Value': variant}
                ]
            }
        ]
    )
```

**4. Analyze Results**
```python
# scripts/analyze_ab_test.py
import boto3
from scipy import stats
import pandas as pd

def analyze_experiment(experiment_name, duration_days=14):
    """
    Statistical analysis of A/B test results
    """
    cloudwatch = boto3.client('cloudwatch')
    
    # Fetch metrics for both variants
    variant_a_data = get_metrics('variant_a', duration_days)
    variant_b_data = get_metrics('variant_b', duration_days)
    
    # Statistical significance test (t-test)
    t_stat, p_value = stats.ttest_ind(
        variant_a_data['satisfaction'],
        variant_b_data['satisfaction']
    )
    
    results = {
        'variant_a': {
            'avg_satisfaction': variant_a_data['satisfaction'].mean(),
            'avg_cost': variant_a_data['cost'].mean(),
            'avg_response_time': variant_a_data['response_time'].mean(),
            'sample_size': len(variant_a_data)
        },
        'variant_b': {
            'avg_satisfaction': variant_b_data['satisfaction'].mean(),
            'avg_cost': variant_b_data['cost'].mean(),
            'avg_response_time': variant_b_data['response_time'].mean(),
            'sample_size': len(variant_b_data)
        },
        'statistical_significance': {
            't_statistic': t_stat,
            'p_value': p_value,
            'is_significant': p_value < 0.05
        }
    }
    
    return results
```

### A/B Test Examples

**Example 1: Dual-Model AI Comparison**
```yaml
Test: Haiku vs Sonnet
Hypothesis: Haiku is 90% as good at 50% cost
Duration: 14 days
Users: 50 (25 per variant)

Results:
  Variant A (Haiku):
    - Satisfaction: 4.2/5
    - Cost: $0.003/query
    - Response time: 1.8s
  
  Variant B (Sonnet):
    - Satisfaction: 4.5/5
    - Cost: $0.006/query
    - Response time: 2.3s
  
  Analysis:
    - Satisfaction diff: 7% (within 10% threshold)
    - Cost reduction: 50% ✅
    - Response time: 22% faster ✅
  
  Decision: Use Haiku for 80% of tasks, Sonnet for 20%
```

**Example 2: UI/UX Changes**
```yaml
Test: New Dashboard Layout
Hypothesis: New layout increases engagement by 15%
Duration: 7 days
Users: 100 (50 per variant)

Results:
  Variant A (Old Layout):
    - Daily active users: 72%
    - Avg session time: 12 minutes
    - Queries per session: 8
  
  Variant B (New Layout):
    - Daily active users: 85%
    - Avg session time: 15 minutes
    - Queries per session: 11
  
  Analysis:
    - Engagement increase: 18% ✅
    - Session time increase: 25% ✅
    - Queries increase: 37% ✅
    - p-value: 0.02 (statistically significant)
  
  Decision: Roll out new layout to all users
```

**Example 3: Email Digest Timing**
```yaml
Test: 9 AM vs 7 AM Digest Email
Hypothesis: 7 AM email increases open rate
Duration: 14 days
Users: 60 (30 per variant)

Results:
  Variant A (9 AM):
    - Open rate: 78%
    - Click rate: 45%
    - Time to first action: 2.5 hours
  
  Variant B (7 AM):
    - Open rate: 82%
    - Click rate: 52%
    - Time to first action: 1.8 hours
  
  Analysis:
    - Open rate increase: 5%
    - Click rate increase: 16% ✅
    - Faster action: 28% ✅
    - p-value: 0.08 (marginally significant)
  
  Decision: Offer user preference (default 7 AM)
```

### Statistical Significance

**Sample Size Calculator:**
```python
def calculate_required_sample_size(
    baseline_rate=0.78,  # Current conversion rate
    minimum_detectable_effect=0.05,  # 5% improvement
    significance_level=0.05,  # 95% confidence
    power=0.80  # 80% power
):
    """
    Calculate required sample size for A/B test
    """
    from statsmodels.stats.power import zt_ind_solve_power
    
    effect_size = minimum_detectable_effect / baseline_rate
    
    sample_size = zt_ind_solve_power(
        effect_size=effect_size,
        alpha=significance_level,
        power=power,
        ratio=1.0,
        alternative='two-sided'
    )
    
    return int(sample_size) * 2  # Total for both variants
```

### Pros & Cons

**Advantages:**
- ✅ Data-driven decisions
- ✅ Measure real user behavior
- ✅ Quantify improvements
- ✅ Reduce risk of bad changes
- ✅ Learn user preferences

**Disadvantages:**
- ⚠️ Requires sufficient traffic
- ⚠️ Takes time (7-14 days minimum)
- ⚠️ Complex statistical analysis
- ⚠️ May confuse users (inconsistent experience)
- ⚠️ Requires tracking infrastructure

### Success Metrics
- Statistical significance (p-value < 0.05)
- Sufficient sample size (>30 per variant)
- Clear winner emerges
- Business metrics improve
- User satisfaction maintained or improved

---

## 🔄 Strategy 7: Shadow Deployment

### Overview
Deploy new version alongside production, send duplicate traffic to both, compare results without affecting users.

### When to Use
- ✅ Testing new AI models without risk
- ✅ Performance comparison
- ✅ Validating refactored code
- ✅ Load testing with real traffic
- ✅ Confidence building before full rollout

### Architecture
```
User Request
    ↓
Production System (v1.0)
    ├─ Process request → Return response to user
    └─ Duplicate request → Shadow System (v2.0)
                              ↓
                         Process silently
                              ↓
                         Compare results
                              ↓
                         Log differences
                              ↓
                         No user impact
```

### Implementation

**1. Request Duplication**
```python
# lambdas/api/shadow_proxy.py
import boto3
import json
from concurrent.futures import ThreadPoolExecutor

lambda_client = boto3.client('lambda')

def invoke_with_shadow(event, context):
    """
    Invoke both production and shadow versions
    Return production result, log shadow result
    """
    
    # Invoke production (synchronous)
    prod_response = invoke_production(event)
    
    # Invoke shadow (asynchronous, don't wait)
    invoke_shadow_async(event, prod_response)
    
    # Return production response immediately
    return prod_response

def invoke_shadow_async(event, prod_response):
    """
    Invoke shadow version and compare results
    """
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(invoke_shadow_and_compare, event, prod_response)
        # Don't wait for result

def invoke_shadow_and_compare(event, prod_response):
    """
    Invoke shadow and log comparison
    """
    try:
        # Invoke shadow version
        shadow_response = lambda_client.invoke(
            FunctionName='CIAlertStack-ProcessorFunction-Shadow',
            InvocationType='RequestResponse',
            Payload=json.dumps(event)
        )
        
        shadow_result = json.loads(shadow_response['Payload'].read())
        
        # Compare results
        comparison = {
            'timestamp': datetime.now().isoformat(),
            'event_id': event.get('requestId'),
            'prod_latency': prod_response.get('latency'),
            'shadow_latency': shadow_result.get('latency'),
            'prod_cost': prod_response.get('cost'),
            'shadow_cost': shadow_result.get('cost'),
            'results_match': compare_outputs(
                prod_response.get('output'),
                shadow_result.get('output')
            )
        }
        
        # Log to CloudWatch
        log_comparison(comparison)
        
    except Exception as e:
        # Shadow failures don't affect production
        log_error(f"Shadow invocation failed: {str(e)}")
```

**2. Result Comparison**
```python
# lambdas/processing/result_comparator.py
from difflib import SequenceMatcher

def compare_outputs(prod_output, shadow_output):
    """
    Compare production and shadow outputs
    """
    # Exact match
    if prod_output == shadow_output:
        return {
            'match_type': 'exact',
            'similarity': 1.0
        }
    
    # Semantic similarity (for AI outputs)
    similarity = SequenceMatcher(None, prod_output, shadow_output).ratio()
    
    return {
        'match_type': 'partial' if similarity > 0.8 else 'different',
        'similarity': similarity,
        'prod_length': len(prod_output),
        'shadow_length': len(shadow_output),
        'diff_percentage': abs(len(prod_output) - len(shadow_output)) / len(prod_output)
    }
```

**3. Analysis Dashboard**
```python
# scripts/analyze_shadow_deployment.py
def analyze_shadow_results(days=7):
    """
    Analyze shadow deployment performance
    """
    logs = fetch_shadow_logs(days)
    
    analysis = {
        'total_requests': len(logs),
        'exact_matches': sum(1 for log in logs if log['similarity'] == 1.0),
        'partial_matches': sum(1 for log in logs if 0.8 <= log['similarity'] < 1.0),
        'different': sum(1 for log in logs if log['similarity'] < 0.8),
        'avg_similarity': sum(log['similarity'] for log in logs) / len(logs),
        'latency_comparison': {
            'prod_avg': sum(log['prod_latency'] for log in logs) / len(logs),
            'shadow_avg': sum(log['shadow_latency'] for log in logs) / len(logs),
            'improvement': calculate_improvement(logs)
        },
        'cost_comparison': {
            'prod_avg': sum(log['prod_cost'] for log in logs) / len(logs),
            'shadow_avg': sum(log['shadow_cost'] for log in logs) / len(logs),
            'savings': calculate_savings(logs)
        }
    }
    
    return analysis
```

### Shadow Deployment Examples

**Example 1: New AI Model Testing**
```yaml
Test: Claude 3.5 Haiku (Shadow) vs Sonnet (Production)
Duration: 7 days
Traffic: 100% duplicated

Results:
  Exact matches: 12%
  Partial matches (>80% similar): 78%
  Different: 10%
  
  Latency:
    Production (Sonnet): 2.3s avg
    Shadow (Haiku): 1.8s avg
    Improvement: 22% faster
  
  Cost:
    Production: $0.006/query
    Shadow: $0.003/query
    Savings: 50%
  
  Decision: Haiku quality acceptable, proceed with canary deployment
```

**Example 2: Code Refactoring Validation**
```yaml
Test: Refactored RAG Architecture
Duration: 3 days
Traffic: 100% duplicated

Results:
  Exact matches: 95%
  Partial matches: 4%
  Different: 1%
  
  Latency:
    Production: 850ms avg
    Shadow: 620ms avg
    Improvement: 27% faster
  
  Errors:
    Production: 0.5%
    Shadow: 0.3%
    Improvement: 40% fewer errors
  
  Decision: Refactoring successful, proceed with blue-green deployment
```

### Pros & Cons

**Advantages:**
- ✅ Zero risk to users
- ✅ Real traffic testing
- ✅ Performance comparison
- ✅ Confidence building
- ✅ Gradual validation

**Disadvantages:**
- ⚠️ 2x compute cost during testing
- ⚠️ Complex implementation
- ⚠️ Requires duplicate infrastructure
- ⚠️ May have side effects (database writes)
- ⚠️ Difficult for stateful systems

### Success Metrics
- >90% similarity in outputs
- Latency improvement or neutral
- Cost reduction or neutral
- Error rate reduction or neutral
- No production impact

---

## 🎯 Strategy 8: Progressive Delivery

### Overview
Combine multiple strategies (canary + feature flags + A/B testing) for sophisticated, low-risk deployments.

### When to Use
- ✅ Enterprise deployments (50-100+ users)
- ✅ Critical system updates
- ✅ Complex feature rollouts
- ✅ Maximum risk mitigation
- ✅ Data-driven optimization

### Architecture
```
Progressive Delivery Pipeline
    ↓
1. Deploy with Feature Flag (disabled)
    ↓
2. Enable for internal team (5 users)
    ↓
3. Shadow deployment (validate with real traffic)
    ↓
4. Canary deployment (5% external users)
    ↓
5. A/B test (50/50 split for 7 days)
    ↓
6. Gradual rollout (10% → 25% → 50% → 100%)
    ↓
7. Monitor for 30 days
    ↓
8. Remove old code
```

### Implementation

**Phase 1: Deploy with Feature Flag**
```bash
# Deploy code with feature disabled
cdk deploy CIAlertStack --parameters FeatureEnabled=false

# Verify deployment
bash scripts/verify-deployment.sh
```

**Phase 2: Internal Testing**
```bash
# Enable for internal team only
bash scripts/enable-feature-flag.sh new-rag-architecture \
  --users "internal-team@company.com"

# Monitor for 2 days
bash scripts/monitor-feature.sh new-rag-architecture --duration 48h
```

**Phase 3: Shadow Deployment**
```bash
# Enable shadow mode (duplicate traffic)
bash scripts/enable-shadow.sh new-rag-architecture

# Monitor for 3 days
bash scripts/monitor-shadow.sh --duration 72h

# Analyze results
python scripts/analyze_shadow_results.py
```

**Phase 4: Canary Deployment**
```bash
# Enable for 5% of users
bash scripts/enable-feature-flag.sh new-rag-architecture --percentage 5

# Monitor for 2 days
bash scripts/monitor-canary.sh --duration 48h

# If good, increase to 10%
bash scripts/enable-feature-flag.sh new-rag-architecture --percentage 10
```

**Phase 5: A/B Testing**
```bash
# 50/50 split for statistical analysis
bash scripts/start-ab-test.sh new-rag-architecture \
  --variant-a old-rag \
  --variant-b new-rag \
  --split 50/50 \
  --duration 7d

# Analyze results
python scripts/analyze_ab_test.py new-rag-architecture
```

**Phase 6: Gradual Rollout**
```bash
# Based on A/B test results, roll out gradually
bash scripts/gradual-rollout.sh new-rag-architecture \
  --schedule "10%,25%,50%,75%,100%" \
  --interval 2d

# Monitor each phase
bash scripts/monitor-rollout.sh new-rag-architecture
```

**Phase 7: Monitoring Period**
```bash
# Monitor for 30 days
bash scripts/long-term-monitor.sh new-rag-architecture --duration 30d

# Weekly reviews
bash scripts/weekly-review.sh new-rag-architecture
```

**Phase 8: Cleanup**
```bash
# Remove old code paths
bash scripts/remove-old-code.sh old-rag-architecture

# Remove feature flag
bash scripts/remove-feature-flag.sh new-rag-architecture

# Update documentation
bash scripts/update-docs.sh
```

### Progressive Delivery Timeline

**Total Duration: 6-8 weeks**

| Week | Phase | Activity | Risk Level |
|------|-------|----------|------------|
| 1 | Deploy + Internal | Feature flag, 5 internal users | Very Low |
| 2 | Shadow | Duplicate traffic, no user impact | Very Low |
| 3 | Canary | 5% → 10% external users | Low |
| 4-5 | A/B Test | 50/50 split, statistical analysis | Low |
| 6 | Gradual Rollout | 25% → 50% → 75% | Medium |
| 7 | Full Rollout | 100% of users | Medium |
| 8-11 | Monitor | Long-term stability | Low |
| 12 | Cleanup | Remove old code | Very Low |

### Pros & Cons

**Advantages:**
- ✅ Lowest possible risk
- ✅ Maximum confidence
- ✅ Data-driven decisions
- ✅ Multiple validation points
- ✅ Easy rollback at any stage

**Disadvantages:**
- ⚠️ Very long deployment (6-8 weeks)
- ⚠️ High operational overhead
- ⚠️ Complex coordination
- ⚠️ Expensive (multiple environments)
- ⚠️ Requires dedicated team

### Success Metrics
- Zero production incidents
- Positive A/B test results
- User satisfaction maintained
- Performance improved
- Cost optimized

---

## 📊 Advanced Deployment Comparison

| Strategy | Duration | Risk | Complexity | Cost | Best For |
|----------|----------|------|------------|------|----------|
| **Big Bang** | 2-3 hours | High | Low | Low | Initial |
| **Blue-Green** | 1-2 hours | Low | Medium | Medium | Updates |
| **Canary** | 4-8 hours | Very Low | High | Medium | High-risk |
| **Rolling** | 45-60 min | Low | High | Low | Enterprise |
| **Feature Flags** | 1-2 hours | Very Low | Medium | Low | Features |
| **A/B Testing** | 7-14 days | Low | High | Medium | Optimization |
| **Shadow** | 3-7 days | Very Low | High | High | Validation |
| **Progressive** | 6-8 weeks | Minimal | Very High | High | Critical |

---

## 🎓 Deployment Strategy Selection Guide

### Quick Decision Matrix

**Choose Big Bang if:**
- Initial deployment
- < 10 users
- Can tolerate downtime
- Low-risk changes

**Choose Blue-Green if:**
- Production updates
- 10-25 users
- Zero downtime required
- Need easy rollback

**Choose Canary if:**
- 25-50 users
- High-risk changes
- Need gradual validation
- Have monitoring infrastructure

**Choose Rolling if:**
- 50-100+ users
- Container-based (ECS/Kubernetes)
- Continuous deployment
- High availability critical

**Choose Feature Flags if:**
- Any team size
- A/B testing needed
- Gradual feature rollout
- Want instant enable/disable

**Choose A/B Testing if:**
- Need data-driven decisions
- Comparing alternatives
- Optimizing metrics
- Have sufficient traffic

**Choose Shadow if:**
- Testing new AI models
- Validating refactoring
- Zero risk tolerance
- Can afford 2x cost temporarily

**Choose Progressive if:**
- Enterprise critical systems
- Maximum risk mitigation
- Have 6-8 weeks
- Dedicated deployment team

---

## 🔧 Implementation Scripts

### A/B Test Script
```bash
#!/bin/bash
# scripts/start-ab-test.sh

EXPERIMENT_NAME=$1
VARIANT_A=$2
VARIANT_B=$3
SPLIT=$4
DURATION=$5

# Create experiment configuration
cat > experiments/${EXPERIMENT_NAME}.yaml <<EOF
experiment:
  name: "${EXPERIMENT_NAME}"
  variants:
    a: "${VARIANT_A}"
    b: "${VARIANT_B}"
  split: ${SPLIT}
  duration: ${DURATION}
  start_date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

# Deploy experiment
aws lambda update-function-configuration \
  --function-name CIAlertStack-ProcessorFunction \
  --environment Variables="{AB_TEST_CONFIG=experiments/${EXPERIMENT_NAME}.yaml}"

echo "A/B test started: ${EXPERIMENT_NAME}"
echo "Monitor: bash scripts/monitor-ab-test.sh ${EXPERIMENT_NAME}"
```

### Shadow Deployment Script
```bash
#!/bin/bash
# scripts/enable-shadow.sh

FEATURE_NAME=$1

# Deploy shadow version
cdk deploy CIAlertStack-Shadow \
  --parameters FeatureName=${FEATURE_NAME}

# Enable request duplication
aws lambda update-function-configuration \
  --function-name CIAlertStack-ProcessorFunction \
  --environment Variables="{SHADOW_ENABLED=true,SHADOW_FUNCTION=CIAlertStack-ProcessorFunction-Shadow}"

echo "Shadow deployment enabled for: ${FEATURE_NAME}"
echo "Monitor: bash scripts/monitor-shadow.sh"
```

### Progressive Rollout Script
```bash
#!/bin/bash
# scripts/gradual-rollout.sh

FEATURE_NAME=$1
SCHEDULE=$2  # "10,25,50,75,100"
INTERVAL=$3  # "2d"

IFS=',' read -ra PERCENTAGES <<< "$SCHEDULE"

for PERCENTAGE in "${PERCENTAGES[@]}"; do
  echo "Rolling out to ${PERCENTAGE}%..."
  
  # Update feature flag
  bash scripts/enable-feature-flag.sh ${FEATURE_NAME} --percentage ${PERCENTAGE}
  
  # Monitor
  bash scripts/monitor-rollout.sh ${FEATURE_NAME} --duration ${INTERVAL}
  
  # Check for issues
  ERROR_RATE=$(bash scripts/get-error-rate.sh ${FEATURE_NAME})
  if (( $(echo "$ERROR_RATE > 5.0" | bc -l) )); then
    echo "Error rate too high (${ERROR_RATE}%), rolling back..."
    bash scripts/rollback-feature.sh ${FEATURE_NAME}
    exit 1
  fi
  
  echo "Phase ${PERCENTAGE}% successful, waiting ${INTERVAL}..."
  sleep ${INTERVAL}
done

echo "Gradual rollout complete: ${FEATURE_NAME} at 100%"
```

---

## 📈 Monitoring & Analytics

### Key Metrics Dashboard

```yaml
Deployment Metrics:
  - Deployment frequency
  - Lead time for changes
  - Mean time to recovery (MTTR)
  - Change failure rate
  
Performance Metrics:
  - API latency (p50, p95, p99)
  - Error rate
  - Throughput (requests/second)
  - Availability (uptime %)
  
Business Metrics:
  - User engagement
  - Feature adoption rate
  - Cost per user
  - Customer satisfaction (CSAT)
  
A/B Test Metrics:
  - Conversion rate
  - User retention
  - Session duration
  - Revenue per user
```

### Automated Decision Making

```python
# scripts/automated_rollout_decision.py
def should_proceed_with_rollout(metrics):
    """
    Automated decision based on metrics
    """
    checks = {
        'error_rate': metrics['error_rate'] < 1.0,
        'latency': metrics['p95_latency'] < 500,
        'satisfaction': metrics['user_satisfaction'] > 4.0,
        'cost': metrics['cost_per_query'] < 0.01
    }
    
    # All checks must pass
    if all(checks.values()):
        return {
            'decision': 'PROCEED',
            'confidence': 'HIGH',
            'recommendation': 'Increase rollout percentage'
        }
    
    # Some checks fail
    failed_checks = [k for k, v in checks.items() if not v]
    
    if len(failed_checks) == 1:
        return {
            'decision': 'MONITOR',
            'confidence': 'MEDIUM',
            'recommendation': f'Watch {failed_checks[0]} closely'
        }
    
    # Multiple checks fail
    return {
        'decision': 'ROLLBACK',
        'confidence': 'HIGH',
        'recommendation': 'Immediate rollback required'
    }
```

---

## ✅ Complete Deployment Checklist

### Planning Phase
- [ ] Choose deployment strategy
- [ ] Define success metrics
- [ ] Calculate required sample size (for A/B tests)
- [ ] Prepare rollback plan
- [ ] Schedule deployment window
- [ ] Notify stakeholders

### Preparation Phase
- [ ] Backup current data
- [ ] Test in staging
- [ ] Set up monitoring dashboards
- [ ] Configure alerting rules
- [ ] Prepare communication templates
- [ ] Assign team roles

### Execution Phase
- [ ] Execute deployment script
- [ ] Monitor metrics in real-time
- [ ] Verify health checks
- [ ] Test critical user paths
- [ ] Document any issues
- [ ] Communicate status updates

### Validation Phase
- [ ] Run smoke tests
- [ ] Check error rates
- [ ] Verify performance metrics
- [ ] Collect user feedback
- [ ] Analyze A/B test results (if applicable)
- [ ] Review cost impact

### Completion Phase
- [ ] Monitor for 24-48 hours
- [ ] Conduct retrospective
- [ ] Update documentation
- [ ] Clean up old resources
- [ ] Plan next deployment
- [ ] Share learnings with team

---

## 🎯 Best Practices Summary

1. **Start Simple, Scale Complexity**
   - Begin with Big Bang or Blue-Green
   - Add A/B testing as you grow
   - Use Progressive Delivery for critical systems

2. **Always Have Rollback Plan**
   - Test rollback procedure
   - Document rollback steps
   - Practice rollback drills

3. **Monitor Everything**
   - Set up monitoring before deployment
   - Track business metrics, not just technical
   - Use automated alerting

4. **Communicate Clearly**
   - Notify users of changes
   - Share deployment status
   - Collect and act on feedback

5. **Learn and Improve**
   - Conduct retrospectives
   - Document lessons learned
   - Continuously optimize process

---

**Recommended Progression:**
1. **Months 1-3:** Big Bang → Blue-Green
2. **Months 4-6:** Add Feature Flags
3. **Months 7-9:** Implement Canary
4. **Months 10-12:** Add A/B Testing
5. **Year 2+:** Progressive Delivery for critical changes


---

## 🔙 Comprehensive Rollback Strategies

### Overview
Every deployment needs a tested rollback plan. Speed of rollback is critical - aim for < 5 minutes.

---

## 🚨 Rollback Strategy 1: DNS Rollback (Blue-Green)

### Speed: < 60 seconds
### Risk: Very Low
### Complexity: Low

**When to Use:**
- Blue-Green deployments
- DNS-based traffic routing
- Need instant rollback

**Implementation:**
```bash
#!/bin/bash
# scripts/rollback-dns.sh

ENVIRONMENT=$1  # blue or green

# Update Route 53 to point back to previous environment
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://rollback-to-${ENVIRONMENT}.json

# Verify DNS change
echo "Waiting for DNS propagation..."
sleep 30

# Test endpoint
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://ci-alert.company.com/health)

if [ "$RESPONSE" == "200" ]; then
  echo "✅ Rollback successful - ${ENVIRONMENT} is now active"
else
  echo "❌ Rollback failed - HTTP ${RESPONSE}"
  exit 1
fi

# Send notification
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789:deployments \
  --message "ROLLBACK: Switched traffic back to ${ENVIRONMENT}"
```

**Rollback Time:** 30-60 seconds (DNS propagation)

---

## 🔄 Rollback Strategy 2: Load Balancer Weight Adjustment (Canary)

### Speed: < 30 seconds
### Risk: Very Low
### Complexity: Low

**When to Use:**
- Canary deployments
- ALB/NLB traffic splitting
- Gradual rollback needed

**Implementation:**
```bash
#!/bin/bash
# scripts/rollback-canary.sh

# Set canary traffic to 0%
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions '[{
    "Type": "forward",
    "ForwardConfig": {
      "TargetGroups": [
        {"TargetGroupArn": "'$STABLE_TG'", "Weight": 100},
        {"TargetGroupArn": "'$CANARY_TG'", "Weight": 0}
      ]
    }
  }]'

echo "✅ Canary traffic set to 0% - all traffic on stable version"

# Monitor for 5 minutes
bash scripts/monitor-metrics.sh --duration 5m

# If stable, decommission canary
read -p "Decommission canary environment? (y/n) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  aws cloudformation delete-stack --stack-name CIAlertStack-Canary
fi
```

**Rollback Time:** < 30 seconds

---

## 🔁 Rollback Strategy 3: ECS Task Definition Revert (Rolling)

### Speed: 5-10 minutes
### Risk: Low
### Complexity: Medium

**When to Use:**
- ECS/Fargate deployments
- Rolling updates
- Container-based systems

**Implementation:**
```bash
#!/bin/bash
# scripts/rollback-ecs.sh

# Get previous task definition
CURRENT_TASK=$(aws ecs describe-services \
  --cluster ci-alert-cluster \
  --services ci-alert-service \
  --query 'services[0].taskDefinition' \
  --output text)

echo "Current task: $CURRENT_TASK"

# Extract revision number
CURRENT_REV=$(echo $CURRENT_TASK | grep -oP '(?<=:)\d+$')
PREVIOUS_REV=$((CURRENT_REV - 1))
PREVIOUS_TASK="ci-alert-task:${PREVIOUS_REV}"

echo "Rolling back to: $PREVIOUS_TASK"

# Update service with previous task definition
aws ecs update-service \
  --cluster ci-alert-cluster \
  --service ci-alert-service \
  --task-definition $PREVIOUS_TASK \
  --force-new-deployment

# Wait for rollback to complete
echo "Waiting for rollback to complete..."
aws ecs wait services-stable \
  --cluster ci-alert-cluster \
  --services ci-alert-service

echo "✅ Rollback complete"

# Verify health
bash scripts/verify-health.sh
```

**Rollback Time:** 5-10 minutes (depends on task count)

---

## 🚩 Rollback Strategy 4: Feature Flag Disable

### Speed: < 5 seconds
### Risk: Very Low
### Complexity: Very Low

**When to Use:**
- Feature flag deployments
- Need instant rollback
- No infrastructure changes

**Implementation:**
```bash
#!/bin/bash
# scripts/rollback-feature-flag.sh

FEATURE_NAME=$1

# Disable feature flag immediately
aws appconfig start-deployment \
  --application-id ci-alert-app \
  --environment-id production \
  --deployment-strategy-id instant \
  --configuration-profile-id $FEATURE_NAME \
  --configuration-version 1 \
  --description "Emergency rollback of ${FEATURE_NAME}"

echo "✅ Feature flag disabled: ${FEATURE_NAME}"

# Verify users see old version
sleep 5
bash scripts/verify-feature-disabled.sh $FEATURE_NAME
```

**Rollback Time:** < 5 seconds

---

## 💾 Rollback Strategy 5: Database Rollback

### Speed: 10-60 minutes
### Risk: High
### Complexity: Very High

**When to Use:**
- Schema changes
- Data migrations
- Last resort only

**Implementation:**
```bash
#!/bin/bash
# scripts/rollback-database.sh

BACKUP_ID=$1

echo "⚠️  WARNING: Database rollback is destructive"
read -p "Continue? (type 'ROLLBACK' to confirm): " CONFIRM

if [ "$CONFIRM" != "ROLLBACK" ]; then
  echo "Rollback cancelled"
  exit 1
fi

# Stop application traffic
echo "Stopping application..."
bash scripts/stop-traffic.sh

# Restore from backup
echo "Restoring database from backup: $BACKUP_ID"
aws dynamodb restore-table-from-backup \
  --target-table-name InsightsTable-Rollback \
  --backup-arn $BACKUP_ID

# Wait for restore
aws dynamodb wait table-exists --table-name InsightsTable-Rollback

# Swap tables
echo "Swapping tables..."
aws dynamodb update-table \
  --table-name InsightsTable \
  --global-secondary-index-updates '[{
    "Delete": {"IndexName": "GSI1"}
  }]'

# Resume traffic
echo "Resuming traffic..."
bash scripts/resume-traffic.sh

echo "✅ Database rollback complete"
```

**Rollback Time:** 10-60 minutes (depends on data size)

---

## 🎯 Rollback Decision Matrix

| Scenario | Strategy | Speed | Risk | Recommended |
|----------|----------|-------|------|-------------|
| **Bad deployment** | DNS/LB rollback | < 1 min | Low | ✅ Yes |
| **High error rate** | Feature flag disable | < 5 sec | Very Low | ✅ Yes |
| **Performance issue** | Canary to 0% | < 30 sec | Low | ✅ Yes |
| **Security issue** | Immediate rollback | < 1 min | Low | ✅ Yes |
| **Data corruption** | Database restore | 10-60 min | High | ⚠️ Last resort |
| **User complaints** | Gradual rollback | 5-10 min | Low | ✅ Yes |

---

## 🚧 Common Deployment Bottlenecks

### Bottleneck 1: Cold Start Latency (Lambda)

**Problem:**
- First request after deployment: 3-5 seconds
- Users experience slow response
- Affects user satisfaction

**Symptoms:**
```
API latency p99: 5000ms (normal: 500ms)
Lambda Duration: 4800ms (normal: 200ms)
Cold Start Rate: 45% (normal: 5%)
```

**Solutions:**

**Solution A: Provisioned Concurrency**
```bash
# Enable provisioned concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name CIAlertStack-ProcessorFunction \
  --provisioned-concurrent-executions 5

# Cost: ~$10/month for 5 concurrent executions
```

**Solution B: Warm-Up Script**
```bash
#!/bin/bash
# scripts/warmup-lambdas.sh

FUNCTIONS=(
  "CIAlertStack-ProcessorFunction"
  "CIAlertStack-InsightsFunction"
  "CIAlertStack-WatchlistFunction"
)

for FUNC in "${FUNCTIONS[@]}"; do
  echo "Warming up: $FUNC"
  for i in {1..10}; do
    aws lambda invoke \
      --function-name $FUNC \
      --payload '{"warmup": true}' \
      /dev/null &
  done
done

wait
echo "✅ All functions warmed up"
```

**Solution C: Scheduled Warm-Up (EventBridge)**
```yaml
# Every 5 minutes during business hours
WarmUpRule:
  Type: AWS::Events::Rule
  Properties:
    ScheduleExpression: "rate(5 minutes)"
    Targets:
      - Arn: !GetAtt ProcessorFunction.Arn
        Input: '{"warmup": true}'
```

**Impact:** Reduces cold starts from 45% to < 5%

---

### Bottleneck 2: Database Migration Downtime

**Problem:**
- Schema changes require downtime
- Users can't access system
- Data migration takes hours

**Symptoms:**
```
Deployment time: 4 hours (normal: 1 hour)
Downtime: 3 hours
User complaints: 50+
```

**Solutions:**

**Solution A: Backward-Compatible Migrations**
```python
# Step 1: Add new column (backward compatible)
# Deploy code that writes to both old and new columns
# Old code still works

# Step 2: Migrate data in background
# No downtime required

# Step 3: Deploy code that reads from new column
# Still backward compatible

# Step 4: Remove old column
# After all code updated
```

**Solution B: Blue-Green Database**
```bash
# Create read replica
aws dynamodb create-global-table \
  --global-table-name InsightsTable-Global \
  --replication-group RegionName=us-east-1,RegionName=us-west-2

# Migrate data to new schema in replica
python scripts/migrate_data.py --target us-west-2

# Switch application to new region
bash scripts/switch-region.sh us-west-2

# Zero downtime
```

**Solution C: Dual-Write Pattern**
```python
def save_insight(insight):
    # Write to both old and new schema
    save_to_old_table(insight)
    save_to_new_table(insight)
    
    # Read from new table, fallback to old
    try:
        return read_from_new_table(insight.id)
    except:
        return read_from_old_table(insight.id)
```

**Impact:** Reduces downtime from 3 hours to 0 minutes

---

### Bottleneck 3: Docker Image Build Time

**Problem:**
- Building Docker images takes 10-15 minutes
- Slows down deployment pipeline
- Blocks other deployments

**Symptoms:**
```
Build time: 15 minutes (normal: 2 minutes)
Pipeline duration: 25 minutes (normal: 5 minutes)
Deployment frequency: 2/day (target: 10/day)
```

**Solutions:**

**Solution A: Multi-Stage Builds**
```dockerfile
# Dockerfile (optimized)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]

# Build time: 15min → 3min (80% reduction)
```

**Solution B: Layer Caching**
```bash
# Use BuildKit for better caching
export DOCKER_BUILDKIT=1

docker build \
  --cache-from ci-alert:latest \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t ci-alert:new .

# Build time: 15min → 2min (87% reduction)
```

**Solution C: Pre-Built Base Images**
```dockerfile
# Create base image with dependencies
FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --only=production

# Application image (fast)
FROM base
COPY . .
RUN npm run build

# Build time: 15min → 1min (93% reduction)
```

**Impact:** Increases deployment frequency from 2/day to 10/day

---

### Bottleneck 4: CloudFormation Stack Updates

**Problem:**
- Stack updates take 20-30 minutes
- Blocks other infrastructure changes
- Difficult to rollback

**Symptoms:**
```
Stack update time: 25 minutes (normal: 5 minutes)
Rollback time: 30 minutes
Failed deployments: 15%
```

**Solutions:**

**Solution A: Nested Stacks**
```typescript
// Split into smaller stacks
const databaseStack = new DatabaseStack(app, 'Database');
const computeStack = new ComputeStack(app, 'Compute', {
  table: databaseStack.table
});
const frontendStack = new FrontendStack(app, 'Frontend', {
  api: computeStack.api
});

// Update only what changed
// Database change: 5 minutes (not 25)
```

**Solution B: CDK Hotswap**
```bash
# Fast deployment for Lambda/ECS changes
cdk deploy --hotswap

# Bypasses CloudFormation for supported resources
# Deployment time: 25min → 30sec (98% reduction)
```

**Solution C: Parallel Stack Updates**
```bash
# Update independent stacks in parallel
cdk deploy CIAlertStack-Database &
cdk deploy CIAlertStack-Compute &
cdk deploy CIAlertStack-Frontend &
wait

# Total time: 25min → 8min (68% reduction)
```

**Impact:** Reduces deployment time from 25 minutes to 5 minutes

---

### Bottleneck 5: API Gateway Throttling

**Problem:**
- Sudden traffic spike during deployment
- API Gateway throttles requests
- Users see 429 errors

**Symptoms:**
```
Error rate: 25% (normal: 0.5%)
429 errors: 1,500/minute
User complaints: 30+
```

**Solutions:**

**Solution A: Increase Throttle Limits**
```bash
# Increase API Gateway limits
aws apigateway update-stage \
  --rest-api-id abc123 \
  --stage-name production \
  --patch-operations \
    op=replace,path=/throttle/rateLimit,value=5000 \
    op=replace,path=/throttle/burstLimit,value=10000

# Cost: ~$5/month additional
```

**Solution B: Implement Retry Logic**
```javascript
// frontend/src/api.js
async function apiCall(endpoint, options, retries = 3) {
  try {
    const response = await fetch(endpoint, options);
    
    if (response.status === 429) {
      // Exponential backoff
      const delay = Math.pow(2, 3 - retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      if (retries > 0) {
        return apiCall(endpoint, options, retries - 1);
      }
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      return apiCall(endpoint, options, retries - 1);
    }
    throw error;
  }
}
```

**Solution C: Request Queuing**
```python
# lambdas/api/rate_limiter.py
import boto3
from datetime import datetime, timedelta

sqs = boto3.client('sqs')

def handle_request(event):
    # Check if under load
    if is_under_load():
        # Queue request for later processing
        sqs.send_message(
            QueueUrl=os.environ['QUEUE_URL'],
            MessageBody=json.dumps(event)
        )
        return {
            'statusCode': 202,
            'body': 'Request queued for processing'
        }
    
    # Process immediately
    return process_request(event)
```

**Impact:** Reduces error rate from 25% to < 1%

---

### Bottleneck 6: DynamoDB Hot Partitions

**Problem:**
- All users query same partition key
- Throttled reads/writes
- Slow response times

**Symptoms:**
```
Throttled requests: 500/minute
Read latency p95: 2000ms (normal: 50ms)
ConsumedReadCapacity: 100% of provisioned
```

**Solutions:**

**Solution A: Add GSI with Better Distribution**
```typescript
// Add GSI with composite key
table.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'userId', type: AttributeType.STRING },
  sortKey: { name: 'timestamp', type: AttributeType.NUMBER },
  projectionType: ProjectionType.ALL
});

// Query by userId instead of single partition
```

**Solution B: Partition Key Sharding**
```python
# Add shard suffix to partition key
def get_partition_key(molecule):
    shard = hash(molecule) % 10  # 10 shards
    return f"{molecule}#{shard}"

# Distribute load across 10 partitions
```

**Solution C: Switch to On-Demand Mode**
```bash
# Switch from provisioned to on-demand
aws dynamodb update-table \
  --table-name InsightsTable \
  --billing-mode PAY_PER_REQUEST

# Automatically scales, no throttling
# Cost: ~$5-10/month additional
```

**Impact:** Reduces throttling from 500/min to 0

---

### Bottleneck 7: S3 Eventual Consistency

**Problem:**
- Upload file to S3
- Immediately try to read
- File not found (eventual consistency)

**Symptoms:**
```
S3 404 errors: 50/hour
Knowledge base sync failures: 15%
User uploads fail: 10%
```

**Solutions:**

**Solution A: Retry with Exponential Backoff**
```python
import time

def read_from_s3_with_retry(bucket, key, max_retries=5):
    for attempt in range(max_retries):
        try:
            response = s3.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()
        except s3.exceptions.NoSuchKey:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 1s, 2s, 4s, 8s, 16s
            else:
                raise
```

**Solution B: Use S3 Strong Consistency**
```python
# S3 now provides strong read-after-write consistency
# No code changes needed, just ensure SDK is updated
# boto3 >= 1.16.0
```

**Solution C: Event-Driven Processing**
```yaml
# Use S3 event notifications instead of immediate read
S3Bucket:
  Type: AWS::S3::Bucket
  Properties:
    NotificationConfiguration:
      LambdaConfigurations:
        - Event: s3:ObjectCreated:*
          Function: !GetAtt ProcessorFunction.Arn

# Lambda triggered when file is ready
```

**Impact:** Reduces S3 errors from 50/hour to 0

---

## 📊 Bottleneck Detection & Monitoring

### Key Metrics to Monitor

```yaml
Performance Bottlenecks:
  - API latency p95 > 1000ms
  - Lambda cold start rate > 10%
  - Database throttled requests > 0
  - S3 error rate > 1%
  
Capacity Bottlenecks:
  - CPU utilization > 80%
  - Memory utilization > 85%
  - Concurrent executions > 80% of limit
  - API Gateway throttling > 0
  
Cost Bottlenecks:
  - Cost per request increasing
  - Unused provisioned capacity
  - Inefficient queries
  - Over-provisioned resources
```

### Automated Bottleneck Detection

```python
# scripts/detect_bottlenecks.py
import boto3
from datetime import datetime, timedelta

cloudwatch = boto3.client('cloudwatch')

def detect_bottlenecks():
    bottlenecks = []
    
    # Check Lambda cold starts
    cold_start_rate = get_metric('AWS/Lambda', 'ColdStartRate')
    if cold_start_rate > 10:
        bottlenecks.append({
            'type': 'Lambda Cold Starts',
            'severity': 'HIGH',
            'value': f'{cold_start_rate}%',
            'recommendation': 'Enable provisioned concurrency'
        })
    
    # Check DynamoDB throttling
    throttled_requests = get_metric('AWS/DynamoDB', 'ThrottledRequests')
    if throttled_requests > 0:
        bottlenecks.append({
            'type': 'DynamoDB Throttling',
            'severity': 'CRITICAL',
            'value': f'{throttled_requests} requests/min',
            'recommendation': 'Switch to on-demand or increase capacity'
        })
    
    # Check API Gateway errors
    error_rate = get_metric('AWS/ApiGateway', '5XXError')
    if error_rate > 1:
        bottlenecks.append({
            'type': 'API Gateway Errors',
            'severity': 'HIGH',
            'value': f'{error_rate}%',
            'recommendation': 'Check Lambda errors and timeouts'
        })
    
    return bottlenecks

# Run daily and alert if bottlenecks found
```

---

## 🎯 Rollback & Bottleneck Best Practices

### Rollback Best Practices

1. **Test Rollback Procedures**
   ```bash
   # Monthly rollback drill
   bash scripts/rollback-drill.sh
   ```

2. **Automate Rollback Decisions**
   ```python
   if error_rate > 5% or latency_p95 > 2000:
       trigger_automatic_rollback()
   ```

3. **Document Rollback Steps**
   ```markdown
   # Rollback Runbook
   1. Run: bash scripts/rollback.sh
   2. Verify: bash scripts/verify-rollback.sh
   3. Notify: bash scripts/notify-users.sh
   4. Monitor: bash scripts/monitor-metrics.sh --duration 1h
   ```

4. **Keep Previous Versions**
   ```bash
   # Retain last 3 versions
   aws lambda update-function-configuration \
     --function-name ProcessorFunction \
     --environment Variables="{RETAIN_VERSIONS=3}"
   ```

5. **Practice Rollbacks**
   ```bash
   # Quarterly rollback exercise
   # 1. Deploy new version
   # 2. Intentionally break something
   # 3. Practice rollback
   # 4. Measure rollback time
   ```

### Bottleneck Prevention

1. **Load Testing Before Deployment**
   ```bash
   # Test with 2x expected load
   bash scripts/load-test.sh --users 200 --duration 30m
   ```

2. **Gradual Rollout**
   ```bash
   # Start with 5%, monitor, then increase
   bash scripts/gradual-rollout.sh --schedule "5,10,25,50,100"
   ```

3. **Capacity Planning**
   ```python
   # Calculate required capacity
   expected_users = 100
   queries_per_user = 50
   total_queries = expected_users * queries_per_user
   required_capacity = total_queries / 3600  # per second
   ```

4. **Performance Budgets**
   ```yaml
   performance_budgets:
     api_latency_p95: 500ms
     error_rate: 1%
     cold_start_rate: 5%
     cost_per_query: $0.01
   ```

5. **Continuous Monitoring**
   ```bash
   # Real-time bottleneck detection
   bash scripts/monitor-bottlenecks.sh --alert-on-detection
   ```

---

## ✅ Rollback & Bottleneck Checklist

### Pre-Deployment
- [ ] Test rollback procedure
- [ ] Document rollback steps
- [ ] Set up automated rollback triggers
- [ ] Load test with 2x expected traffic
- [ ] Identify potential bottlenecks
- [ ] Prepare capacity scaling plan

### During Deployment
- [ ] Monitor key metrics in real-time
- [ ] Watch for bottleneck indicators
- [ ] Have rollback command ready
- [ ] Team on standby for rollback
- [ ] Document any issues

### Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Analyze bottleneck metrics
- [ ] Review rollback readiness
- [ ] Update runbooks
- [ ] Plan optimizations

---

**Key Takeaway:** Fast rollback (< 5 minutes) and proactive bottleneck detection are critical for reliable deployments. Test rollback procedures regularly and monitor for bottlenecks continuously.
