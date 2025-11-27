# Interview Questions - CI Alert System

## Architecture & System Design

### 1. Explain the overall architecture of this system. Why did you choose AWS services like Lambda, DynamoDB, and EventBridge?

**Expected answer:** 
- Serverless approach for cost-efficiency and auto-scaling
- DynamoDB for real-time, low-latency queries with flexible schemas
- EventBridge for scheduled tasks (midnight ingestion, 9 AM digests)
- Lambda for event-driven processing without managing servers
- Pay-per-use model aligns with variable pharmaceutical news ingestion

### 2. How does data flow from PubMed ingestion to a user seeing insights in the frontend?

**Expected answer:**
```
EventBridge trigger (midnight)
    ↓
PubMed Lambda function (fetch articles)
    ↓
SQS queue (decoupling & retry)
    ↓
Processor Lambda (batch processing)
    ↓
Bedrock Claude 3 Sonnet (AI analysis)
    ↓
DynamoDB InsightsTable (store insights)
    ↓
API Gateway endpoint (authenticated)
    ↓
React frontend (display to user)
```

### 3. What's the purpose of the SQS queue in the ingestion pipeline?

**Expected answer:**
- Decouples PubMed fetching from processing (independent scaling)
- Provides built-in retry logic with dead-letter queues
- Handles traffic spikes gracefully
- Ensures no insights are lost due to Lambda timeouts
- Enables monitoring of queue depth for performance metrics

---

## Backend & Lambda

### 4. How do you handle authentication and authorization in the API?

**Expected answer:**
- Cognito User Pool for user management
- JWT tokens issued by Cognito after sign-in
- API Gateway Cognito Authorizer validates every token
- All endpoints require valid JWT in Authorization header
- Token includes userId claim for per-user data access

### 5. Describe the processor.py Lambda function. What does it do with Bedrock Claude?

**Expected answer:**
- Consumes messages from SQS queue (PubMed articles)
- Extracts article metadata (title, abstract, molecules mentioned)
- Calls Bedrock Claude 3 Sonnet with system prompt for pharmaceutical analysis
- Generates insights (impact assessment, clinical relevance, competitive implications)
- Stores insights in DynamoDB with molecule name as partition key
- Implements error handling and CloudWatch logging

### 6. How would you implement retry logic if Bedrock API fails during processing?

**Expected answer:**
- SQS provides automatic retries (default: 3 attempts)
- Use Dead Letter Queue for messages exceeding max receive count
- Implement exponential backoff in Lambda code
- Lambda reserved concurrency to prevent throttling
- CloudWatch alarms on DLQ messages for alerting
- Manual replay of failed messages from DLQ

### 7. What's the primary key design in DynamoDB tables? Why?

**Expected answer:**
- **InsightsTable:** PK = molecule name, SK = timestamp
  - Allows efficient lookup of all insights for a molecule
  - Supports time-series queries (recent insights first)
  - Enables GSI on timestamp for "all recent insights" queries
  
- **WatchlistTable:** PK = userId, SK = molecule name
  - Per-user watchlist queries are O(1)
  - Easy to add/remove molecules for a user
  - Supports GSI on molecule name for "who's watching this molecule"
  
- **UserSettingsTable:** PK = userId (simple)
  - Straightforward user preference lookup
  - Single item per user

---

## Frontend & Security

### 8. How does the React frontend authenticate users?

**Expected answer:**
- AWS Amplify SDK handles Cognito integration
- `Auth.signUp()` creates new user account
- `Auth.signIn()` returns JWT token
- Token stored in browser localStorage or sessionStorage
- Token included in all API requests via Authorization header
- `Auth.signOut()` clears token on logout
- Frontend checks token expiration and refreshes if needed

### 9. How do you secure the S3 frontend content?

**Expected answer:**
- S3 bucket policy restricts access to CloudFront only (using Origin Access Identity)
- Block all public access to S3
- HTTPS enforced via CloudFront distribution
- CloudFront uses TLS 1.2+ for encryption in transit
- No direct S3 URL access - all traffic goes through CloudFront
- S3 versioning enabled for rollback capability

### 10. What security measures protect DynamoDB from unauthorized access?

**Expected answer:**
- IAM roles with least privilege policies
- Lambda execution role only allows DynamoDB access to specific tables
- API Gateway Cognito authorizer validates users before Lambda invocation
- DynamoDB encryption at rest (AWS managed keys)
- VPC endpoints for DynamoDB to avoid internet routing
- CloudTrail logging for audit trail
- Row-level security: Lambda code ensures userId-based filtering

---

## Notifications & Workflows

### 11. Explain the daily digest workflow. How do you ensure emails are sent at 9 AM UTC?

**Expected answer:**
- EventBridge rule with cron expression: `0 9 * * ? *` (9 AM UTC every day)
- Triggers DigestFunction automatically
- DigestFunction queries UserSettingsTable for users with `digestEnabled = true`
- For each user:
  - Queries InsightsTable for insights from past 24 hours
  - Groups insights by molecule
  - Formats as HTML email
  - Sends via SES (Simple Email Service)
- SES requires verified email sender address
- CloudWatch logs track delivery success/failure

### 12. How would you handle a scenario where a user's email bounces in SES?

**Expected answer:**
- Configure SES SNS topics for bounce notifications
- Subscribe Lambda to SNS bounce topic
- Lambda updates UserSettingsTable, marking email as invalid
- Implement bounce suppression list in SES
- Retry with new email address from user profile
- Send notification to user requesting email update
- Dashboard shows bounce rate metrics
- Manual review for permanent bounces vs. temporary failures

### 13. What happens if EventBridge misses a scheduled trigger (e.g., 9 AM digest)?

**Expected answer:**
- EventBridge has very high reliability (99.99% SLA)
- Monitor with CloudWatch alarms on failed invocations
- Manual backup: `bash test.sh digest` for on-demand testing
- Check CloudWatch Logs for DigestFunction errors
- If failure detected:
  - Check SES service status
  - Verify IAM permissions for Lambda
  - Check DynamoDB capacity
  - Review recent code deployments
- Set up SNS notifications for EventBridge rule failures
- Consider dead-letter queue for events that fail

---

## Deployment & DevOps

### 14. Walk me through the deployment process using CDK. What are the 4 stacks?

**Expected answer:**

1. **CIAlertStack (Core)**
   - DynamoDB tables (Insights, Watchlist, UserSettings)
   - Lambda functions (PubMed, Processor, API handlers, Digest)
   - API Gateway with Cognito authorizer
   - SQS queue and dead-letter queue
   - EventBridge rules
   - IAM roles and policies

2. **CIAlert-Frontend**
   - S3 bucket for React app
   - CloudFront distribution
   - Origin Access Identity (OAI)
   - CloudFront caching policies

3. **CIAlert-Monitoring**
   - CloudWatch Dashboard
   - CloudWatch Alarms (errors, latency, capacity)
   - Log groups configuration
   - SNS topics for alerts

4. **CIAlert-CICD**
   - CodePipeline for CI/CD
   - CodeBuild for running tests
   - CodeDeploy for automated deployments
   - GitHub integration

**Why separation?**
- Modularity and reusability
- Different deployment cadences
- Team ownership (backend vs. frontend vs. DevOps)
- Independent scaling and cost tracking

### 15. How do you handle infrastructure changes without downtime?

**Expected answer:**
- CloudFormation updates are mostly zero-downtime for managed services
- DynamoDB: Supports on-demand scaling, no downtime for schema changes
- Lambda: New versions deployed, old versions serve existing requests
- API Gateway: Updates don't interrupt existing connections
- For breaking API changes:
  - Deploy new API version alongside old one
  - Use API versioning in URL path (/v1, /v2)
  - Migrate clients gradually
- S3 + CloudFront: New build uploaded, CloudFront invalidation clears cache
- Database migrations: Plan separately, test in dev/staging first

### 16. What happens if `cdk deploy` fails halfway through?

**Expected answer:**
- CloudFormation automatically rolls back partial updates
- Check CloudFormation console for failed resources
- Review CloudFormation event logs for error messages
- Common causes:
  - IAM permissions missing
  - Service limits exceeded
  - Invalid parameter values
  - Lambda package too large
- Use `fix-rollback.sh` to manually clean up stuck stacks
- Run `cdk diff` before deploy to preview changes
- Test in dev environment first
- Keep deployment idempotent (safe to retry)

### 17. How would you implement CI/CD for this project?

**Expected answer:**
- **Trigger:** Push to main branch on GitHub
- **Pipeline stages:**
  1. **Source** - CodePipeline pulls from GitHub
  2. **Build** - CodeBuild runs:
     - `npm install` for dependencies
     - `npm run build` for React frontend
     - `npm run test` for unit tests
     - `bash test.sh system` for integration tests
  3. **Deploy** - CodePipeline runs:
     - `cdk deploy --all` for infrastructure
     - Auto-approval or manual approval before prod
  4. **Post-Deploy** - CodeBuild runs:
     - `bash test.sh api` for smoke tests
     - CloudWatch alarms check for failures
- Rollback: Previous CDK state in version control
- Secrets: Store AWS credentials in CodeBuild environment variables (not in repo)

---

## Monitoring & Troubleshooting

### 18. How do you monitor if the daily ingestion failed?

**Expected answer:**
- **Check logs:** `aws logs tail /aws/lambda/CIAlertStack-PubMedFunction --follow`
- **CloudWatch Alarms:**
  - Lambda errors > 5 in 5 minutes
  - Lambda duration > timeout
  - SQS queue depth increasing (no consumer)
- **Manual test:** `bash test.sh ingestion` to trigger PubMed function
- **Check SQS:**
  - Messages in queue (being processed?)
  - Messages in dead-letter queue (failures?)
  - Oldest message age (stuck?)
- **Bedrock permissions:**
  - Verify Lambda role allows `bedrock:InvokeModel`
  - Check Bedrock model availability in region
- **PubMed API:**
  - Rate limit exceeded?
  - API endpoint down?
  - Network connectivity from Lambda to internet?

### 19. A user reports "No insights showing" - how would you debug?

**Expected answer:**
1. **Check InsightsTable:** `aws dynamodb query --table-name InsightsTable --key-condition-expression "molecule = :m" --expression-attribute-values "{\":m\":{\"S\":\"insulin\"}}"`
2. **Verify ingestion ran:**
   - Check PubMedFunction logs (last 24 hours)
   - Is SQS queue empty or backed up?
3. **Check processing:**
   - ProcessorFunction logs - any Bedrock errors?
   - SQS dead-letter queue - failed messages?
4. **Verify API endpoint:**
   - Test API directly: `curl -H "Authorization: Bearer $TOKEN" https://api-endpoint/insights`
   - Check API Gateway logs for 401/403 errors
5. **Frontend issues:**
   - Check browser console for errors
   - Verify JWT token is valid and not expired
   - Check network tab in DevTools for API responses
6. **Molecular data:**
   - Is the molecule spelled correctly in PubMed search?
   - Are there actually articles mentioning it?

### 20. How would you optimize Lambda cold starts?

**Expected answer:**
- **Lambda Layers:** Pre-package dependencies (boto3, requests) to reduce package size
- **Provisioned Concurrency:** Keep a few instances warm for critical functions (ProcessorFunction, DigestFunction)
- **Keep functions small:** Remove unused dependencies, minimize code
- **Minimize imports:** Only import used libraries at module level
- **Optimize package size:**
  - Strip unnecessary files from dependencies
  - Use Lambda layer for large libraries
  - Consider native compiled Python wheels for performance
- **Runtime selection:** Python 3.11+ is faster than older versions
- **Memory allocation:** Higher memory = faster CPU = faster cold start
- **Connection pooling:** Reuse DynamoDB/Bedrock clients across invocations

---

## Cost Optimization

### 21. The current estimate is $10-15/month. How would you reduce this further?

**Expected answer:**
- **DynamoDB:**
  - On-demand is already cost-effective for variable traffic
  - Set TTL on old insights to auto-delete (reduce storage)
  - Archive cold data to S3 Glacier (5+ years old)
  
- **Lambda:**
  - Reduce function timeout (currently may be generous)
  - Batch insights processing (reduce invocations)
  - Remove unused functions/layers
  
- **S3 + CloudFront:**
  - S3 Lifecycle: Move old versions to Glacier after 30 days
  - CloudFront cache TTL optimization (longer = fewer origin requests)
  - Gzip compression for text assets
  
- **EventBridge:**
  - Currently low cost, minimal optimization needed
  
- **SES:**
  - Negotiate volume discounts if sending 1K+ emails
  - Segment digests to reduce unnecessary emails
  
- **CloudWatch:**
  - Reduce log retention (currently may be verbose)
  - Adjust alarm thresholds to reduce notifications
  - Consolidate metrics
  
- **Cognito:**
  - Free tier covers 50K MAU - optimize if exceeding
  
- **Infrastructure:**
  - Consolidate stacks if using separate dev/staging
  - Use spot instances for non-critical workloads

### 22. Why use DynamoDB on-demand instead of provisioned capacity?

**Expected answer:**
- **Unpredictable traffic:** Pharmaceutical news ingestion is bursty (major announcements cause spikes)
- **Auto-scaling:** On-demand scales automatically, avoiding over/under-provisioning
- **Pay-per-request:** Only pay for actual usage (read/write units)
- **No upfront capacity planning:** Reduces operational overhead
- **Better for new systems:** Traffic patterns unknown, on-demand is safer
- **Trade-off:** Slightly higher per-request cost vs. provisioned, but optimal for variable loads
- **Alternative:** If traffic becomes predictable (baseline known), switch to provisioned with auto-scaling

---

## Python & Code Quality

### 23. In processor.py, how do you call Bedrock Claude? What parameters matter?

**Expected answer:**
```python
import boto3
import json

bedrock = boto3.client('bedrock-runtime')

response = bedrock.invoke_model(
    modelId='anthropic.claude-3-sonnet-20240229-v1:0',
    body=json.dumps({
        'anthropic_version': 'bedrock-2023-06-01',
        'max_tokens': 1024,
        'temperature': 0.7,  # Balance creativity and consistency
        'messages': [
            {
                'role': 'user',
                'content': 'Analyze this pharmaceutical article...'
            }
        ],
        'system': 'You are a pharmaceutical analyst...'
    })
)

# Parse response
result = json.loads(response['body'].read())
insight = result['content'][0]['text']
```

**Key parameters:**
- **modelId:** Claude 3 Sonnet (balanced cost/performance)
- **max_tokens:** Limit response length (cost control)
- **temperature:** 0.7 = balanced creativity (0 = deterministic, 1 = random)
- **system:** Role/context for Claude
- **messages:** Conversation history

### 24. How would you implement pagination for the `/insights` API if results are large?

**Expected answer:**
```python
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('InsightsTable')

# Query with limit and pagination
response = table.query(
    KeyConditionExpression='molecule = :mol',
    ExpressionAttributeValues={':mol': 'aspirin'},
    Limit=20,  # Return 20 items
    ScanIndexForward=False,  # Most recent first
    ExclusiveStartKey=pagination_token  # Start from last key
)

# Return to client
return {
    'insights': response['Items'],
    'nextToken': response.get('LastEvaluatedKey'),  # For next page
    'count': response['Count'],
    'total': response['ScannedCount']
}
```

**Implementation details:**
- Use `Limit` to fetch batch of 20-50 items
- Return `LastEvaluatedKey` as `nextToken` to client
- Client includes `nextToken` in next request
- Frontend handles pagination UI (next/previous buttons)

---

## Real-World Scenarios

### 25. A pharmaceutical company wants to add real-time alerts (not just daily digests). How would you redesign?

**Expected answer:**
**Current design:** EventBridge cron → daily digests

**New design:**
1. **Real-time trigger:** SNS topic on new insights
   - ProcessorFunction publishes to SNS on insight creation
   - Includes severity/urgency level

2. **Alert thresholds:** DynamoDB AlertConfigTable
   - Store per-user alert rules (e.g., "notify if clinical trial starts")
   - Lambda evaluates insight against rules

3. **Multiple channels:**
   - Critical alerts: SMS via SNS SMS topic
   - Normal alerts: Push notifications via mobile app
   - Archived: Email digest remains

4. **WebSocket API:**
   - API Gateway WebSocket for real-time dashboard updates
   - DynamoDB stores active connections
   - SNS publishes → Lambda pushes to WebSocket clients

5. **Architecture:**
```
Processor Lambda
    ↓
SNS Topic (InsightCreated)
    ↓
Alert Filter Lambda (check user rules)
    ↓
Parallel:
   - SMS topic
   - Push notification service
   - WebSocket push
   - Email queue (for batching)
```

### 26. How would you ensure HIPAA compliance for healthcare data?

**Expected answer:**
- **Encryption:**
  - Data at rest: DynamoDB encryption, S3 encryption
  - Data in transit: HTTPS only via CloudFront
  - Key management: AWS KMS for key rotation

- **Access Controls:**
  - IAM least privilege (specific table/item access)
  - MFA on AWS console
  - No hardcoded credentials
  - VPC endpoints to avoid internet exposure

- **Audit Logging:**
  - CloudTrail logs all API calls (who accessed what, when)
  - DynamoDB Point-in-Time Recovery enabled
  - S3 object lock for immutable logs

- **Data Retention:**
  - TTL on old insights (auto-delete after compliance period)
  - Archive to S3 Glacier for long-term retention
  - Clear deletion procedures

- **User Privacy:**
  - No PII in logs (de-identify before logging)
  - User consent for data collection/processing
  - Right to deletion (GDPR/CCPA compliance)

- **Network Security:**
  - VPC with private subnets for Lambda
  - NACLs restrict traffic
  - WAF (Web Application Firewall) on API Gateway

- **Incident Response:**
  - CloudWatch alarms for unauthorized access
  - SNS notifications to security team
  - Documented breach response procedure

### 27. A competitor is scanning your API. How do you protect it?

**Expected answer:**
- **Rate Limiting:**
  - API Gateway throttling (10K requests/second default)
  - Cognito user-level throttling (1K/minute per user)
  
- **DDoS Protection:**
  - AWS Shield Standard (automatic)
  - AWS Shield Advanced (paid, 24/7 monitoring)
  - CloudFront edge caching reduces origin load
  
- **WAF (Web Application Firewall):**
  - AWS WAF on CloudFront/API Gateway
  - Rules to block:
    - Excessive requests from single IP
    - SQL injection attempts
    - XSS payloads
    - Scanning signatures (User-Agent patterns)
  
- **IP Whitelisting:**
  - Restrict to known partner IPs (if applicable)
  - Lambda checks source IP in custom authorizer
  
- **API Key Rotation:**
  - Regularly rotate JWT secrets
  - Short expiration times (15 min access, 1 week refresh)
  
- **Monitoring & Alerting:**
  - CloudWatch metrics: 4xx/5xx errors, latency, request count
  - Alert on suspicious patterns (spike in 401/403)
  - Block IPs showing attack patterns
  
- **Obfuscation:**
  - Don't expose API implementation details in error messages
  - Generic error responses ("Unauthorized")
  - Remove server headers that reveal AWS

---

## Database & Data

### 28. How would you handle a molecule that appears in multiple insights with same timestamp?

**Expected answer:**
- **Problem:** DynamoDB sort key (SK) must be unique for same partition key (molecule)
- **Solutions:**

**Option 1: Add UUID to sort key**
```
SK = timestamp#UUID
Example: 2024-01-15T09:30:00Z#a1b2c3d4
```

**Option 2: Add sequence number**
```
SK = timestamp#sequence
Example: 2024-01-15T09:30:00Z#001
```

**Option 3: Add insight_id**
```
SK = insight_id
Use GSI on timestamp for time-range queries
```

**Recommendation:** Option 2 (timestamp#sequence)
- Human-readable
- Maintains temporal order
- Supports DynamoDB sort order
- Query: `molecule = 'insulin' AND begins_with(sk, '2024-01-15')`

**For retrieval:**
- Specify sort order in query (ScanIndexForward=False for newest first)
- Use Global Secondary Index for alternative query patterns

### 29. What's your backup strategy for DynamoDB?

**Expected answer:**
- **Point-in-Time Recovery (PITR):**
  - Enabled on all tables
  - Automatic backups for 35 days
  - Restore to any second in backup window
  - Zero downtime restore
  
- **Continuous Backups:**
  - AWS Backup service for centralized management
  - Incremental backups reduce storage
  - Cross-region replication option
  
- **Export to S3:**
  - Daily export of InsightsTable to S3 (non-blocking)
  - Format: DynamoDB JSON or Parquet
  - Enables long-term archival (cost-effective)
  - Supports data analysis/reporting
  
- **Cross-Region Replication:**
  - Global Tables (Active-Active in multiple regions)
  - For disaster recovery
  - Higher cost but zero RPO/RTO
  
- **Backup Schedule:**
  - **InsightsTable:** Daily (on-demand), PITR enabled
  - **UserSettingsTable:** Weekly, PITR enabled
  - **WatchlistTable:** Weekly, PITR enabled
  
- **Disaster Recovery Plan:**
  - RPO (Recovery Point Objective): 24 hours
  - RTO (Recovery Time Objective): 1 hour
  - Test restore quarterly
  - Document recovery procedures
  
- **Cost Optimization:**
  - Use PITR for recent failures (no incremental backup cost)
  - Export to S3 Glacier for long-term archival
  - Set export retention policy

---

## Additional Real-World Questions

### 30. How would you handle Bedrock API rate limiting?

**Expected answer:**
- Implement exponential backoff in processor.py
- Use SQS as buffer (absorbs spike, processes at safe rate)
- Monitor Bedrock invocation metrics in CloudWatch
- Set Lambda concurrency limits to match Bedrock quota
- Request rate limit increase from AWS if needed
- Cache insights for molecules queried frequently
- Implement circuit breaker pattern (stop calls if Bedrock down)

### 31. How do you version your API without breaking clients?

**Expected answer:**
- **URL versioning:** `/v1/insights`, `/v2/insights`
- **Header versioning:** `X-API-Version: 2`
- **Timestamp:** `/insights?apiVersion=2024-01-01`
- Deploy new version alongside old
- Sunset old versions with 6-month notice
- Support both formats in new code
- CloudFront caches different versions separately

### 32. What's your approach to testing?

**Expected answer:**
- **Unit tests:** test.py for Lambda functions (mocks AWS services)
- **Integration tests:** test.sh against dev environment
- **End-to-end tests:** Full flow (Cognito sign-up → API → Email)
- **Load testing:** k6 or Locust for API stress testing
- **Infrastructure tests:** CDK assertions validate stack outputs
- **Monitoring:** CloudWatch alarms catch runtime issues

---

## Summary Tips for Interview

1. **Explain trade-offs:** Why Lambda over EC2? Why DynamoDB over RDS?
2. **Show system thinking:** How components interact, failure modes
3. **Know the architecture diagram:** Be able to draw and explain it
4. **Discuss real challenges:** What would you do differently?
5. **Mention monitoring:** How do you know if something breaks?
6. **Cost awareness:** Understand pricing of each service
7. **Security first:** Explain how you protect user/company data
8. **Prepare examples:** Have specific code snippets ready to discuss
