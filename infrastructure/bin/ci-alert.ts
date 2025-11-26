#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { CICDStack } from '../lib/cicd-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Core Infrastructure
const coreStack = new CIAlertStack(app, 'CIAlertStack', { env });

// Frontend (ECS, CloudFront, WAF)
const frontendStack = new FrontendStack(app, 'CIAlert-Frontend', { env });

// Monitoring (CloudWatch, Alarms)
const monitoringStack = new MonitoringStack(app, 'CIAlert-Monitoring', {
  env,
  alertEmail: process.env.ALERT_EMAIL || 'alerts@example.com',
});

// CI/CD Pipeline
const cicdStack = new CICDStack(app, 'CIAlert-CICD', { env });

app.synth();
