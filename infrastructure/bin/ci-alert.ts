#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { CICDStack } from '../lib/cicd-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// 1. Core Infrastructure
new CIAlertStack(app, 'CIAlertStack', { 
  env,
  description: 'Core CI Alert infrastructure - DynamoDB, Lambda, API Gateway, Cognito',
});

// 2. Frontend (deploy separately)
new FrontendStack(app, 'CIAlert-Frontend', {
  env,
  domainName: app.node.tryGetContext('domainName'),
  certificateArn: app.node.tryGetContext('certificateArn'),
  apiUrl: app.node.tryGetContext('apiUrl'),
  userPoolId: app.node.tryGetContext('userPoolId'),
  userPoolClientId: app.node.tryGetContext('userPoolClientId'),
  description: 'Frontend - ALB, ECS Fargate, VPC, WAF',
});

// 3. CI/CD (deploy separately)
new CICDStack(app, 'CIAlert-CICD', { 
  env,
  description: 'CI/CD pipeline - GitHub, CodePipeline, CodeBuild',
});

app.synth();