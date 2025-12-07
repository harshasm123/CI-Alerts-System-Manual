#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';

const app = new cdk.App();

// Core Infrastructure Stack
new CIAlertStack(app, 'CIAlertStack', { 
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Core CI Alert infrastructure - DynamoDB, Lambda, API Gateway, Cognito',
});

app.synth();