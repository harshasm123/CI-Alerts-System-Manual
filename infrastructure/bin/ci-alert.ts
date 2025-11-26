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

// 1. Core Infrastructure (must deploy first)
const coreStack = new CIAlertStack(app, 'CIAlertStack', { env });

// 2. Frontend (depends on Core for API URL)
const frontendStack = new FrontendStack(app, 'CIAlert-Frontend', {
  env,
  apiUrl: coreStack.apiUrl,
  userPoolId: coreStack.userPoolId,
});
frontendStack.addDependency(coreStack);

// 3. Monitoring (depends on Core for API name)
const monitoringStack = new MonitoringStack(app, 'CIAlert-Monitoring', {
  env,
  apiName: coreStack.apiName,
  alertEmail: process.env.ALERT_EMAIL || 'alerts@example.com',
});
monitoringStack.addDependency(coreStack);

// 4. CI/CD Pipeline (depends on all stacks)
const cicdStack = new CICDStack(app, 'CIAlert-CICD', {
  env,
  stackName: coreStack.stackName,
});
cicdStack.addDependency(coreStack);
cicdStack.addDependency(frontendStack);
cicdStack.addDependency(monitoringStack);

app.synth();
