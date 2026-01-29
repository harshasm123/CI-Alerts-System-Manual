#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const environment = process.env.ENVIRONMENT || 'development';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const region = process.env.AWS_DEFAULT_REGION || 'us-west-2';
const account = process.env.CDK_DEFAULT_ACCOUNT;

const env = { account, region };

const coreStack = new CIAlertStack(app, 'CIAlertStack', {
  env,
  description: 'CI Alert System - Core Infrastructure',
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Owner: adminEmail,
  },
});

const frontendStack = new FrontendStack(app, 'CIAlert-Frontend', {
  env,
  description: 'CI Alert System - S3 + CloudFront Frontend',
  apiUrl: coreStack.apiUrl,
  userPoolId: coreStack.userPoolId,
  userPoolClientId: coreStack.userPoolClientId,
  tags: {
    Environment: environment,
    Project: 'CIAlert',
    Component: 'Frontend',
  },
});

frontendStack.addDependency(coreStack);

cdk.Tags.of(app).add('Project', 'CIAlert');
cdk.Tags.of(app).add('Environment', environment);