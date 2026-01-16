#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { CICDStack } from '../lib/cicd-stack';
import { KnowledgeBaseStack } from '../lib/knowledge-base-stack';
import { BedrockAgentStack } from '../lib/bedrock-agent-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// 1. Core Infrastructure
const coreStack = new CIAlertStack(app, 'CIAlertStack', { 
  env,
  description: 'Core CI Alert infrastructure - DynamoDB, Lambda, API Gateway, Cognito',
});

// 2. Knowledge Base (S3 + OpenSearch + Bedrock KB)
const kbStack = new KnowledgeBaseStack(app, 'CIAlert-KnowledgeBase', {
  env,
  dataBucket: coreStack.dataBucket,
  description: 'Knowledge Base - S3, OpenSearch Serverless, Bedrock KB',
});

// 3. Bedrock Agent (RAG with actions)
const agentStack = new BedrockAgentStack(app, 'CIAlert-BedrockAgent', {
  env,
  knowledgeBaseId: kbStack.knowledgeBaseId,
  insightsTable: coreStack.insightsTable,
  watchlistTable: coreStack.watchlistTable,
  description: 'Bedrock Agent - RAG with DynamoDB actions',
});

// 4. Frontend (ALB + ECS + CloudFront)
const frontendStack = new FrontendStack(app, 'CIAlert-Frontend', {
  env,
  domainName: app.node.tryGetContext('domainName'),
  certificateArn: app.node.tryGetContext('certificateArn'),
  apiUrl: app.node.tryGetContext('apiUrl') || coreStack.apiUrl,
  userPoolId: app.node.tryGetContext('userPoolId') || coreStack.userPoolId,
  userPoolClientId: app.node.tryGetContext('userPoolClientId') || coreStack.userPoolClientId,
  description: 'Frontend - ALB, ECS Fargate, VPC, WAF, CloudFront',
});

// 5. Monitoring (CloudWatch dashboards)
const monitoringStack = new MonitoringStack(app, 'CIAlert-Monitoring', { 
  env,
  apiGateway: coreStack.apiGateway,
  lambdaFunctions: coreStack.lambdaFunctions,
  dynamoTables: coreStack.dynamoTables,
  description: 'Monitoring - CloudWatch dashboards and alarms',
});

// 6. CI/CD (optional)
const cicdStack = new CICDStack(app, 'CIAlert-CICD', { 
  env,
  description: 'CI/CD pipeline - GitHub, CodePipeline, CodeBuild',
});

app.synth();