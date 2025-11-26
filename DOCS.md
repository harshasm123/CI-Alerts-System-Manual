# CI Alert System - Documentation Index

## 📚 Quick Navigation

### Getting Started
- **[QUICKSTART.md](QUICKSTART.md)** - 10-minute deployment guide with step-by-step instructions
- **[README.md](README.md)** - Architecture overview and project description

### Domain Knowledge
- **[USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md](USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md)** - Healthcare CI context, market overview, regulatory landscape
- **[USA_MOLECULES_DATABASE.md](USA_MOLECULES_DATABASE.md)** - Top pharmaceutical molecules and competitive intelligence priorities

### Deployment Scripts
- **deploy.sh** - Main deployment script (all 4 stacks)
- **prereq.sh** - Install prerequisites (AWS CLI, Node.js, CDK, Docker)
- **config.sh** - Configure region and settings
- **fix-region.sh** - Fix CloudFormation hook issues
- **check-bootstrap.sh** - Verify CDK bootstrap health
- **GET_URLS.sh** - Get all deployed URLs and endpoints
- **destroy.sh** - Delete all resources

### Project Structure

```
CI-Alert-System/
├── infrastructure/          # CDK infrastructure code
│   ├── bin/                # CDK app entry point
│   ├── lib/                # Stack definitions
│   │   ├── ci-alert-stack.ts      # Core infrastructure
│   │   ├── frontend-stack.ts      # ECS, CloudFront, WAF
│   │   ├── monitoring-stack.ts    # CloudWatch, Alarms
│   │   └── cicd-stack.ts          # CodePipeline
│   ├── cdk.json            # CDK configuration
│   ├── package.json        # Dependencies
│   └── tsconfig.json       # TypeScript config
│
├── lambdas/                # Lambda function code
│   ├── processing/         # AI processing with Bedrock
│   │   └── processor.py
│   ├── ingestion/          # Data ingestion
│   │   └── pubmed_ingestion.py
│   ├── api/                # REST API handlers
│   │   ├── watchlist_api.py
│   │   └── insights_api.py
│   ├── notifications/      # Email notifications
│   │   └── daily_digest.py
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # React UI (future)
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
│
├── cicd/                   # CI/CD configuration
│   ├── buildspec.yml       # CodeBuild spec
│   └── pipeline.yml        # Pipeline definition
│
├── monitoring/             # Monitoring configuration
│   └── dashboard.json      # CloudWatch dashboard
│
├── scripts/                # Utility scripts
│   ├── setup_bedrock_agent.py
│   └── cleanup-project.sh
│
├── deploy.sh               # Main deployment script
├── prereq.sh               # Prerequisites installer
├── config.sh               # Configuration script
├── fix-region.sh           # Region fixer
├── check-bootstrap.sh      # Bootstrap checker
├── GET_URLS.sh             # URL getter
├── destroy.sh              # Cleanup script
│
├── README.md               # Project overview
├── QUICKSTART.md           # Quick start guide
├── DOCS.md                 # This file
├── LICENSE                 # MIT License
│
├── USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md
└── USA_MOLECULES_DATABASE.md
```

## 🚀 Deployment Workflow

1. **Prerequisites**: `./prereq.sh`
2. **Configure**: `./config.sh` (optional)
3. **Check Bootstrap**: `./check-bootstrap.sh`
4. **Deploy**: `./deploy.sh`
5. **Get URLs**: `./GET_URLS.sh`
6. **Enable Bedrock**: AWS Console
7. **Test**: Use curl commands from GET_URLS.sh

## 🏗️ Architecture

### 4 CloudFormation Stacks

1. **CIAlertStack** (Core)
   - DynamoDB: Insights, Watchlist, UserSettings
   - Lambda: Processor, PubMed, Watchlist API, Insights API
   - API Gateway, Cognito, S3, SQS, EventBridge

2. **CIAlert-Frontend**
   - ECS Fargate, ALB, CloudFront, WAF, ECR

3. **CIAlert-Monitoring**
   - CloudWatch Dashboard, Alarms, SNS

4. **CIAlert-CICD**
   - CodePipeline, CodeBuild, CodeCommit

## 📖 Key Files

### Infrastructure
- `infrastructure/lib/ci-alert-stack.ts` - Core stack (DynamoDB, Lambda, API)
- `infrastructure/lib/frontend-stack.ts` - Frontend stack (ECS, CloudFront)
- `infrastructure/lib/monitoring-stack.ts` - Monitoring stack (CloudWatch)
- `infrastructure/lib/cicd-stack.ts` - CI/CD stack (CodePipeline)
- `infrastructure/bin/ci-alert.ts` - CDK app entry point

### Lambda Functions
- `lambdas/processing/processor.py` - Bedrock Claude integration
- `lambdas/ingestion/pubmed_ingestion.py` - PubMed API integration
- `lambdas/api/watchlist_api.py` - Watchlist CRUD API
- `lambdas/api/insights_api.py` - Insights query API
- `lambdas/notifications/daily_digest.py` - Email digest sender

### Scripts
- `deploy.sh` - Main deployment (bootstrap + deploy all stacks)
- `prereq.sh` - Install AWS CLI, Node.js, CDK, Docker
- `config.sh` - Interactive region/email configuration
- `fix-region.sh` - Auto-fix problematic regions (us-west-2)
- `check-bootstrap.sh` - Verify CDK bootstrap health
- `GET_URLS.sh` - Query all stack outputs
- `destroy.sh` - Delete all stacks and resources

## 🔧 Troubleshooting

### Common Issues

1. **CDK Bootstrap Fails**
   - Run: `./fix-region.sh`
   - Switches from us-west-2 to us-east-1

2. **Build Errors**
   - Run: `cd infrastructure && rm -rf node_modules && npm install`

3. **Bedrock Access Denied**
   - Enable models: AWS Console → Bedrock → Model Access

4. **API Returns 500**
   - Check logs: `aws logs tail /aws/lambda/CIAlertStack-ProcessorFunction --follow`

## 💰 Cost

- **Monthly**: ~$75 (light usage)
- **Breakdown**: DynamoDB $5, Lambda $10, API Gateway $3.50, S3 $2, ECS $30, CloudFront $5, Bedrock $15, Other $5

## 🧹 Cleanup

```bash
./destroy.sh
# Or manually:
cdk destroy --all --force
```

## 📞 Support

- Check QUICKSTART.md for detailed guide
- Review README.md for architecture
- See USA_HEALTHCARE_COMPETITIVE_INTELLIGENCE.md for domain context

## 📄 License

MIT License - See LICENSE file
