#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { KnowledgeBaseStack } from '../lib/knowledge-base-stack';
import { BedrockAgentStack } from '../lib/bedrock-agent-stack';
import { AmplifyStack } from '../lib/amplify-stack';
import { ProductionStack } from '../lib/production-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { CICDStack } from '../lib/cicd-stack';

const app = new cdk.App();

const environment = process.env.ENVIRONMENT || 'development';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const region = process.env.AWS_DEFAULT_REGION || 'us-west-2';
const account = process.env.CDK_DEFAULT_ACCOUNT;

const env = { account, region };

// Core stack
const coreStack = new CIAlertStack(app, 'CIAlertStack', {
  env,
  description: 'CI Alert System - Core Infrastructure',
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Owner: adminEmail,
  },
});

// Knowledge Base stack
const knowledgeBaseStack = new KnowledgeBaseStack(app, 'CIAlert-KnowledgeBase', {
  env,
  description: 'CI Alert System - Knowledge Base',
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Component: 'KnowledgeBase',
  },
});

// Bedrock Agent stack
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

// Amplify Frontend stack
const amplifyStack = new AmplifyStack(app, 'CIAlert-Amplify', {
  env,
  description: 'CI Alert System - Amplify Frontend',
  apiUrl: coreStack.apiUrl,
  userPoolId: coreStack.userPoolId,
  userPoolClientId: coreStack.userPoolClientId,
  repositoryUrl: process.env.GITHUB_REPO_URL,
  githubToken: process.env.GITHUB_TOKEN_SECRET_NAME,
  domainName: process.env.DOMAIN_NAME,
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Component: 'Frontend',
  },
});

// Production enhancements
if (environment === 'production') {
  const productionStack = new ProductionStack(app, 'CIAlert-Production', {
    env,
    description: 'CI Alert System - Production Enhancements',
    coreStack: coreStack,
    amplifyStack: amplifyStack,
    tags: {
      Environment: environment,
      Project: 'CIAlert',
      Component: 'Production',
    },
  });

  const monitoringStack = new MonitoringStack(app, 'CIAlert-Monitoring', {
    env,
    description: 'CI Alert System - Monitoring',
    coreStack: coreStack,
    amplifyStack: amplifyStack,
    adminEmail: adminEmail,
    tags: {
      Environment: environment,
      Project: 'CIAlert',
      Component: 'Monitoring',
    },
  });

  const cicdStack = new CICDStack(app, 'CIAlert-CICD', {
    env,
    description: 'CI Alert System - CI/CD Pipeline',
    repositoryUrl: process.env.GITHUB_REPO_URL || 'https://github.com/your-org/ci-alert-system',
    githubToken: process.env.GITHUB_TOKEN_SECRET_NAME || 'github-token',
    tags: {
      Environment: environment,
      Project: 'CIAlert',
      Component: 'CICD',
    },
  });

  productionStack.addDependency(coreStack);
  productionStack.addDependency(amplifyStack);
  monitoringStack.addDependency(coreStack);
  monitoringStack.addDependency(amplifyStack);
  cicdStack.addDependency(coreStack);
}

knowledgeBaseStack.addDependency(coreStack);
bedrockAgentStack.addDependency(knowledgeBaseStack);
amplifyStack.addDependency(coreStack);

cdk.Tags.of(app).add('Project', 'CIAlert');
cdk.Tags.of(app).add('Environment', environment);