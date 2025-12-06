#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CIAlertStack } from '../lib/ci-alert-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { CICDStack } from '../lib/cicd-stack';
import { BedrockAgentStack } from '../lib/bedrock-agent-stack';
import { KnowledgeBaseStack } from '../lib/knowledge-base-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// All stacks are independent - no dependencies
const coreStack = new CIAlertStack(app, 'CIAlertStack', { env });
const frontendStack = new FrontendStack(app, 'CIAlert-Frontend', { env });
const monitoringStack = new MonitoringStack(app, 'CIAlert-Monitoring', {
  env,
  alertEmail: process.env.ALERT_EMAIL || 'alerts@example.com',
});
const cicdStack = new CICDStack(app, 'CIAlert-CICD', { env });
const knowledgeBaseStack = new KnowledgeBaseStack(app, 'CIAlert-KnowledgeBase', { env });
const bedrockAgentStack = new BedrockAgentStack(app, 'CIAlert-BedrockAgent', { env });

app.synth();
