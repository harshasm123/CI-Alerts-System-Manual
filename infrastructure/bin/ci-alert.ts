#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { CICDStack } from '../lib/cicd-stack';
import { BedrockAgentStack } from '../lib/bedrock-agent-stack';
import { KnowledgeBaseStack } from '../lib/knowledge-base-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Production-grade deployment sequence with proper dependencies

// 1. Core Infrastructure (Independent)
const coreStack = new CIAlertStack(app, 'CIAlertStack', { 
  env,
  description: 'Core CI Alert infrastructure - DynamoDB, Lambda, API Gateway, Cognito',
});

// 2. Knowledge Base (Independent - can be deployed separately)
const knowledgeBaseStack = new KnowledgeBaseStack(app, 'CIAlert-KnowledgeBase', { 
  env,
  description: 'Knowledge Base infrastructure - S3, OpenSearch Serverless, Bedrock KB',
});

// 3. Bedrock Agent (Depends on Knowledge Base)
const bedrockAgentStack = new BedrockAgentStack(app, 'CIAlert-BedrockAgent', { 
  env,
  description: 'Bedrock Agent with RAG capabilities',
});
bedrockAgentStack.addDependency(knowledgeBaseStack);

// 4. Frontend (Production ALB deployment)
const frontendStack = new FrontendStack(app, 'CIAlert-Frontend', {
  env,
  domainName: app.node.tryGetContext('domainName'),
  certificateArn: app.node.tryGetContext('certificateArn'),
  apiUrl: app.node.tryGetContext('apiUrl'),
  userPoolId: app.node.tryGetContext('userPoolId'),
  userPoolClientId: app.node.tryGetContext('userPoolClientId'),
  description: 'Production frontend - ALB, ECS Fargate, VPC, WAF',
});

// 5. Monitoring (Depends on core components)
const monitoringStack = new MonitoringStack(app, 'CIAlert-Monitoring', {
  env,
  alertEmail: process.env.ALERT_EMAIL || 'alerts@example.com',
  description: 'Production monitoring - CloudWatch dashboards, alarms, SNS',
});
monitoringStack.addDependency(coreStack);
monitoringStack.addDependency(frontendStack);

// 6. CI/CD Pipeline (Optional - depends on all other stacks)
const cicdStack = new CICDStack(app, 'CIAlert-CICD', { 
  env,
  description: 'CI/CD pipeline - GitHub, CodePipeline, CodeBuild',
});
cicdStack.addDependency(coreStack);
cicdStack.addDependency(frontendStack);
cicdStack.addDependency(monitoringStack);

// Add tags for production management
cdk.Tags.of(app).add('Project', 'CI-Alert-System');
cdk.Tags.of(app).add('Environment', process.env.ENVIRONMENT || 'production');
cdk.Tags.of(app).add('Owner', 'DevOps');
cdk.Tags.of(app).add('CostCenter', 'Engineering');

app.synth();