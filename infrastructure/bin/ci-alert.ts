#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { AmplifyStack } from '../lib/amplify-stack';
import { CICDStack } from '../lib/cicd-stack';
import { KnowledgeBaseStack } from '../lib/knowledge-base-stack';
import { BedrockAgentStack } from '../lib/bedrock-agent-stack';
import { ProductionStack } from '../lib/production-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';

const app = new cdk.App();

const environment = process.env.ENVIRONMENT || 'development';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const region = process.env.AWS_DEFAULT_REGION || 'us-west-2';
const account = process.env.CDK_DEFAULT_ACCOUNT;

const env = { account, region };

// Core Stack
const coreStack = new CIAlertStack(app, 'CIAlertStack', {
  env,
  description: 'CI Alert System - Core Infrastructure',
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Owner: adminEmail,
  },
});

// Knowledge Base Stack
const knowledgeBaseStack = new KnowledgeBaseStack(app, 'CIAlert-KnowledgeBase', {
  env,
  description: 'CI Alert System - Knowledge Base (OpenSearch + Bedrock)',
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Component: 'KnowledgeBase',
  },
});

// Bedrock Agent Stack
const bedrockAgentStack = new BedrockAgentStack(app, 'CIAlert-BedrockAgent', {
  env,
  description: 'CI Alert System - Bedrock Agent',
  knowledgeBaseId: knowledgeBaseStack.knowledgeBaseId,
  dataSourceBucket: knowledgeBaseStack.dataSourceBucket,
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Component: 'BedrockAgent',
  },
});

// Amplify Frontend Stack
const amplifyStack = new AmplifyStack(app, 'CIAlert-Amplify', {
  env,
  description: 'CI Alert System - Amplify Frontend',
  apiUrl: coreStack.apiUrl,
  userPoolId: coreStack.userPoolId,
  userPoolClientId: coreStack.userPoolClientId,
  repositoryUrl: 'https://github.com/harshasm123/CI-Alerts-System-Manual',
  githubToken: 'github-token',
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Component: 'Frontend',
  },
});

// Production enhancements (only for production environment)
if (environment === 'production') {
  // Production Stack
  const productionStack = new ProductionStack(app, 'CIAlert-Production', {
    env,
    description: 'CI Alert System - Production Enhancements',
    apiGateway: coreStack.api,
    lambdaFunctions: coreStack.lambdaFunctions,
    adminEmail: adminEmail,
    tags: {
      Environment: environment,
      Project: 'CIAlert',
      Component: 'Production',
    },
  });

  // Monitoring Stack
  const monitoringStack = new MonitoringStack(app, 'CIAlert-Monitoring', {
    env,
    description: 'CI Alert System - Monitoring & Dashboards',
    lambdaFunctions: coreStack.lambdaFunctions,
    apiGateway: coreStack.api,
    dynamoTables: coreStack.dynamoTables,
    adminEmail: adminEmail,
    tags: {
      Environment: environment,
      Project: 'CIAlert',
      Component: 'Monitoring',
    },
  });

  // CI/CD Pipeline Stack
  const cicdStack = new CICDStack(app, 'CIAlert-CICD', {
    env,
    description: 'CI Alert System - CI/CD Pipeline',
    repositoryUrl: 'https://github.com/harshasm123/CI-Alerts-System-Manual',
    githubToken: 'github-token',
    tags: {
      Environment: environment,
      Project: 'CIAlert',
      Component: 'CICD',
    },
  });
}

// Dependencies
amplifyStack.addDependency(coreStack);
bedrockAgentStack.addDependency(knowledgeBaseStack);

cdk.Tags.of(app).add('Project', 'CIAlert');
cdk.Tags.of(app).add('Environment', environment);