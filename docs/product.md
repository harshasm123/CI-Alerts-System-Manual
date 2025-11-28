---
inclusion: always
---

# CI Alert System - Product Guide

## System Purpose
Production-grade AWS serverless platform for pharmaceutical competitive intelligence. Ingests drug/molecule news from 5 sources (PubMed, FDA, EMA, ClinicalTrials.gov, WIPO), processes with Amazon Nova Lite for batch processing and Amazon Nova Premier for advanced agent capabilities, delivers personalized daily digest emails at 9 AM UTC.

## Architecture Patterns

### Serverless-First
- All compute via Lambda (Python 3.11+)
- Infrastructure as Code using AWS CDK (TypeScript)
- No EC2 instances in production path
- DynamoDB for data persistence with DAX caching layer

### Security Model
- AWS Cognito for authentication (email-based, no social providers)
- JWT tokens required on ALL API endpoints
- API Gateway with Lambda authorizers
- Secrets in AWS Secrets Manager, never hardcoded

### Data Flow
1. EventBridge triggers ingestion Lambdas (midnight UTC)
2. Raw data → DynamoDB tables (per source)
3. Processor Lambda enriches with Bedrock AI insights
4. Daily digest Lambda (9 AM UTC) queries user watchlists
5. SES sends personalized emails per user

## Development Conventions

### Lambda Functions
- Organize by domain: `/lambdas/{api|ingestion|processing|notifications}/`
- Use shared `requirements.txt` for dependencies
- Handler pattern: `{function_name}.lambda_handler(event, context)`
- Always include error handling and CloudWatch logging

### Frontend (React)
- Located in `/frontend/src/`
- API calls via `/frontend/src/services/api.js`
- Environment variables in `.env` (never commit actual values)
- Pages: Dashboard, Insights, Watchlist, Settings

### Infrastructure (CDK)
- Stacks in `/infrastructure/lib/stacks/`
- Modular: network, storage, compute, api, auth, monitoring, frontend, cicd
- Deploy via `cdk deploy --all` or individual stacks
- Always tag resources with project metadata

## Key Technical Constraints

- **AI Model**: Amazon Nova Lite for batch processing ($0.06/$0.24 per 1M tokens) and Amazon Nova Premier for Bedrock Agent (advanced analysis)
- **Email**: AWS SES (requires verified domain/emails in sandbox mode)
- **Scheduling**: EventBridge rules (0 0 * * ? for midnight, 0 9 * * ? for 9 AM UTC)
- **Cost Target**: $10-15/month for light usage (<100 users, <1000 molecules tracked)

## User Workflows

1. **Sign Up**: Email → Cognito verification → Login
2. **Watchlist Management**: Add/remove molecules via Watchlist page
3. **View Insights**: Dashboard shows recent AI-processed news
4. **Email Preferences**: Settings page controls digest frequency
5. **Daily Digest**: Automated email with watchlist-filtered insights

## When Making Changes

- Maintain serverless architecture (no long-running processes)
- Preserve JWT authentication on all API routes
- Keep ingestion sources independent (failure in one shouldn't affect others)
- Ensure CloudWatch alarms exist for critical paths
- Update relevant documentation in `/docs/` when changing architecture
