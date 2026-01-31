#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { AmplifyStack } from '../lib/amplify-stack';
import { CICDStack } from '../lib/cicd-stack';

const app = new cdk.App();

const environment = process.env.ENVIRONMENT || 'development';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const region = process.env.AWS_DEFAULT_REGION || 'us-west-2';
const account = process.env.CDK_DEFAULT_ACCOUNT;

const env = { account, region };

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

const coreStack = new CIAlertStack(app, 'CIAlertStack', {
  env,
  description: 'CI Alert System - Core Infrastructure',
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Owner: adminEmail,
  },
});

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

amplifyStack.addDependency(coreStack);
// Remove circular dependency - CICD should be independent

cdk.Tags.of(app).add('Project', 'CIAlert');
cdk.Tags.of(app).add('Environment', environment);