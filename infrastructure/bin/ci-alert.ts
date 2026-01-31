#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { AmplifyStack } from '../lib/amplify-stack';
import { ECSCICDStack } from '../lib/ecs-cicd-stack';

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

// Amplify Frontend Stack (Serverless)
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

// ECS CI/CD Stack (Container-based with full CI/CD)
if (process.env.GITHUB_TOKEN) {
  const ecsCicdStack = new ECSCICDStack(app, 'CIAlert-ECS-CICD', {
    env,
    description: 'CI Alert System - ECS with CI/CD Pipeline',
    githubToken: process.env.GITHUB_TOKEN,
    githubOwner: process.env.GITHUB_OWNER || 'harshasm123',
    githubRepo: process.env.GITHUB_REPO || 'CI-Alerts-System-Manual',
    apiUrl: coreStack.apiUrl,
    userPoolId: coreStack.userPoolId,
    userPoolClientId: coreStack.userPoolClientId,
    tags: {
      Environment: environment,
      Project: 'CIAlert',
      Component: 'ECS-CICD',
    },
  });
  
  ecsCicdStack.addDependency(coreStack);
}

amplifyStack.addDependency(coreStack);

cdk.Tags.of(app).add('Project', 'CIAlert');
cdk.Tags.of(app).add('Environment', environment);