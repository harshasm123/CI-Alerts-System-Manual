# ALB vs CloudFront: Complete Comparison

## Quick Decision Matrix

| Need | Best Choice | Why |
|------|-------------|-----|
| **Global users** | ☁️ CloudFront + ALB | 80% faster, edge caching |
| **Internal only** | 🔁 ALB only | Simpler, no need for CDN |
| **Cost-first** | 🔁 ALB only | CloudFront adds $2-5/mo |
| **Production app** | ☁️ CloudFront + ALB | Industry standard, enterprise-grade |
| **Static site** | 🪣 S3 + CloudFront | Cheapest option ($5/mo) |
| **API-heavy** | 🔁 ALB only | APIs shouldn't be cached via CDN |

---

## Architecture Comparison

### ALB Only (Current in this system)
```
User → ALB (Regional) → ECS Fargate → React App
       Single point of entry
       No caching
       No compression at edge
       Higher latency for distant users
```

**Characteristics:**
- ✅ Simple architecture
- ✅ Good for regional users
- ✅ Less moving parts
- ❌ 150-300ms latency (global)
- ❌ No global caching
- ❌ Higher bandwidth costs
- ❌ Limited DDoS protection

---

### ALB + CloudFront (RECOMMENDED for production)
```
User (Asia) → CloudFront (Tokyo Edge) [Cache: Hit!] → Response in 30ms
User (Europe) → CloudFront (Frankfurt Edge) [Cache: Hit!] → Response in 40ms
User (USA) → CloudFront (Virginia Edge) [Cache: Hit!] → Response in 20ms
                          ↓
                     (5% cache miss)
                          ↓
                      ALB → ECS Fargate
```

**Characteristics:**
- ✅ 299 edge locations worldwide
- ✅ 80-95% cache hit rate for static assets
- ✅ 30-80ms latency (global)
- ✅ 60% less bandwidth (due to caching)
- ✅ Automatic GZIP/Brotli compression
- ✅ WAF + DDoS protection
- ✅ Enterprise-grade
- ⚠️ Slightly more complex
- ⚠️ Need to invalidate cache on deploys

---

## Caching Behavior

### ALB Only
```
Request Flow:
User → ALB → ECS → App Process → User Response (every time)
       ↓
       Every request hits your app
       No caching at all
       100% load on origin
```

### ALB + CloudFront
```
First Request (Miss):
User → CloudFront → ALB → ECS → App → CloudFront (cache) → User

Subsequent Requests (Hit):
User → CloudFront ✓ CACHE HIT → User (instant, no origin call)
```

**Cache TTL (Time to Live):**
- index.html: 5 minutes (update often)
- static/app.js: 1 year (content hash, never changes)
- static/styles.css: 1 year (content hash)
- /api/*: 0 seconds (never cache dynamic data)

---

## Performance Comparison

### Latency by Geography

| Location | ALB Only | ALB + CloudFront | Improvement |
|----------|----------|------------------|------------|
| **USA East** | 50ms | 20ms | 60% faster |
| **USA West** | 120ms | 40ms | 67% faster |
| **Europe** | 180ms | 50ms | 72% faster |
| **Asia Pacific** | 250ms | 60ms | 76% faster |
| **South America** | 280ms | 70ms | 75% faster |

### Bandwidth Usage (1M Requests/Month)

```
ALB Only:
- Total bytes transferred: 500GB
- Cost: 500GB × $0.085 = $42.50

ALB + CloudFront:
- Total bytes transferred: 200GB (cache hit)
- Cost: 200GB × $0.085 = $17.00
- Savings: $25.50/month (60%)
```

---

## Cost Analysis

### Monthly Costs (Light Usage: 100K Requests/Month)

#### ALB Only
```
Load Balancer:        $16.20
ECS Fargate:          $25.00
NAT Gateway:          $5.00 (for outbound)
Data Transfer Out:    $10.00 (no caching)
─────────────────────────────
Total:                ~$56/month
```

#### ALB + CloudFront
```
Load Balancer:        $16.20
ECS Fargate:          $25.00
CloudFront:           $2.50 (distributed globally)
NAT Gateway:          $5.00
Data Transfer Out:    $3.00 (60% less - cached)
─────────────────────────────
Total:                ~$51/month

Savings: $5/month vs ALB only
```

#### Break-even Analysis
- CloudFront costs ~$2.50/month
- Saves ~$25/month in bandwidth
- **Break-even immediately** ✓

---

## Feature Comparison

| Feature | ALB | CloudFront | Importance |
|---------|-----|-----------|-----------|
| **Global Distribution** | ❌ Regional | ✅ 299 locations | ⭐⭐⭐⭐⭐ |
| **Content Caching** | ❌ No | ✅ Yes | ⭐⭐⭐⭐⭐ |
| **Compression** | ❌ Origin only | ✅ At edge | ⭐⭐⭐⭐ |
| **HTTPS/TLS** | ✅ Yes | ✅ Yes | ⭐⭐⭐⭐⭐ |
| **WAF** | ✅ Yes | ✅ Yes | ⭐⭐⭐⭐ |
| **DDoS Protection** | ✅ Shield Std | ✅ Shield Std | ⭐⭐⭐⭐ |
| **Rate Limiting** | ✅ Yes | ✅ Yes | ⭐⭐⭐ |
| **Logging** | ✅ CloudWatch | ✅ CloudWatch | ⭐⭐⭐ |
| **Auto-scaling** | ✅ Yes | ✅ Automatic | ⭐⭐⭐⭐ |
| **Custom Domain** | ✅ Yes | ✅ Yes | ⭐⭐⭐⭐⭐ |
| **Setup Complexity** | 🟢 Simple | 🟡 Medium | ⭐⭐ |
| **Operational Overhead** | 🟢 Low | 🟡 Medium | ⭐⭐ |

---

## When to Use Each

### Use ALB Only When:
- ✅ **Internal/Regional users only**
  - Company employees in one location
  - Internal dashboards
  - Development/staging environments

- ✅ **Latency not critical**
  - Data processing apps
  - Background jobs
  - Batch operations

- ✅ **Want simplicity**
  - Small team
  - Learning/proof-of-concept
  - Minimal ops overhead

**Example:** Pharmacy staff in USA only accessing CI alerts

---

### Use ALB + CloudFront When:
- ✅ **Public-facing app**
  - Accessible to partners worldwide
  - Public website/portal
  - Mobile apps

- ✅ **Performance matters**
  - Consumer-facing app
  - Competitive product
  - SLA guarantees

- ✅ **Global user base**
  - Multinational company
  - International product
  - Distributed team

- ✅ **Cost optimization**
  - High bandwidth usage
  - Large user base
  - Want to save on data transfer

**Example:** Pharmaceutical CI alerts for global research teams

---

### Use S3 + CloudFront When:
- ✅ **Pure static site**
  - No backend needed
  - No database
  - No API calls

- ✅ **Maximum cost efficiency**
  - Cheapest option (~$5/month)
  - No compute needed

- ✅ **High availability needs**
  - No single point of failure
  - Built-in redundancy

**Example:** Product documentation, landing page, blog

---

## Migration Path

### From ALB Only → ALB + CloudFront

**Step 1: Deploy CloudFront** (takes 10-15 min)
```bash
cd infrastructure && cdk deploy CIAlert-Frontend
```

**Step 2: Test CloudFront URL**
```bash
# Get CloudFront URL from outputs
aws cloudformation describe-stacks --stack-name CIAlert-Frontend --query 'Stacks[0].Outputs' --output table
```

**Step 3: Gradual Traffic Migration** (optional)
- 10% users on CloudFront URL (test)
- 50% users on CloudFront URL (monitor)
- 100% users on CloudFront URL (production)

**Step 4: Add Custom Domain** (optional)
```bash
# Update cdk.json with domain and cert ARN
cdk deploy CIAlert-Frontend
```

**Step 5: Invalidate Cache on Code Changes**
```bash
bash scripts/invalidate-cloudfront.sh
```

---

## Monitoring & Optimization

### Key Metrics to Track

```bash
# Cache Hit Ratio (target: 80%+)
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=... \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

### Optimization Checklist
- ✅ Cache TTL: static assets 1 year, HTML 5 min, API 0
- ✅ Compression: gzip + brotli enabled
- ✅ Price class: PRICE_CLASS_100 (includes Asia/Europe)
- ✅ HTTP version: HTTP/2 and HTTP/3
- ✅ Logging: enabled for 30 days
- ✅ WAF: OWASP managed rules + rate limiting
- ✅ Origin verification: custom header check

---

## Troubleshooting

### CloudFront Returns 502/503
```bash
# 1. Check origin (ALB) health
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:...

# 2. Check ECS service
aws ecs describe-services --cluster ci-alert-frontend-cluster --services FrontendService

# 3. Check ALB security group
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### Users See Old Version
```bash
# Invalidate CloudFront cache
bash scripts/invalidate-cloudfront.sh

# Or specific files
bash scripts/invalidate-cloudfront.sh "/index.html /static/*"
```

### High 4xx Errors
```bash
# Check WAF rules blocking requests
aws wafv2 get-web-acl --name FrontendWebACL --scope CLOUDFRONT

# Temporarily disable rate limiting if needed
# (Edit WAF rules in console)
```

---

## Recommendation

**For this pharmaceutical CI Alert System:**
✅ **Use ALB + CloudFront** because:
1. **Public-facing app** - Global pharmaceutical research teams
2. **Performance critical** - Real-time CI alerts
3. **Cost-effective** - Actually saves $5/month vs ALB alone
4. **Enterprise-grade** - Meets production requirements
5. **Already implemented** - Code is ready to deploy

**Deploy with:**
```bash
bash deploy-cloudfront-frontend.sh
```

**Quick start (no domain):**
```bash
cd infrastructure && cdk deploy CIAlert-Frontend
# Get CloudFront URL from outputs
# Use: https://d1234567890.cloudfront.net
```

---

## Summary Table

```
┌─────────────────┬────────────────┬──────────────────┬─────────────────┐
│ Aspect          │ ALB Only       │ ALB + CloudFront │ S3 + CloudFront │
├─────────────────┼────────────────┼──────────────────┼─────────────────┤
│ Global Speed    │ Slow (150-300) │ Fast (30-80ms)   │ Fast (30-60ms)  │
│ Monthly Cost    │ $56            │ $51              │ $5              │
│ Setup Time      │ 5 minutes      │ 15 minutes       │ 10 minutes      │
│ Caching         │ None           │ Excellent        │ Excellent       │
│ API Support     │ Yes            │ Yes              │ No              │
│ Complexity      │ Low            │ Medium           │ Low             │
│ Best For        │ Regional only  │ Production ✓✓✓   │ Static sites    │
└─────────────────┴────────────────┴──────────────────┴─────────────────┘
```
