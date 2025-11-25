#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from './stacks/network-stack';
import { StorageStack } from './stacks/storage-stack';
import { ComputeStack } from './stacks/compute-stack';
import { AuthStack } from './stacks/auth-stack';
import { ApiStack } from './stacks/api-stack';
import { FrontendStack } from './stacks/frontend-stack';
import { MonitoringStack } from './stacks/monitoring-stack';
import { CicdStack } from './stacks/cicd-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Core infrastructure stacks
const networkStack = new NetworkStack(app, 'CIAlert-Network', { env });
const storageStack = new StorageStack(app, 'CIAlert-Storage', { env });
const authStack = new AuthStack(app, 'CIAlert-Auth', { env });

// Compute and API stacks
const computeStack = new ComputeStack(app, 'CIAlert-Compute', {
  env,
  vpc: networkStack.vpc,
  dataBucket: storageStack.dataBucket,
  insightsTable: storageStack.insightsTable,
  userSettingsTable: storageStack.userSettingsTable,
  watchlistTable: storageStack.watchlistTable,
  rawEventQueue: storageStack.rawEventQueue,
});

const apiStack = new ApiStack(app, 'CIAlert-API', {
  env,
  vpc: networkStack.vpc,
  userPool: authStack.userPool,
  insightsTable: storageStack.insightsTable,
  userSettingsTable: storageStack.userSettingsTable,
  watchlistTable: storageStack.watchlistTable,
});

// Frontend stack
const frontendStack = new FrontendStack(app, 'CIAlert-Frontend', {
  env,
  vpc: networkStack.vpc,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  apiGateway: apiStack.apiGateway,
});

// Monitoring and CI/CD
const monitoringStack = new MonitoringStack(app, 'CIAlert-Monitoring', {
  env,
  lambdaFunctions: computeStack.lambdaFunctions,
  ecsService: frontendStack.ecsService,
  apiGateway: apiStack.apiGateway,
});

const cicdStack = new CicdStack(app, 'CIAlert-CICD', {
  env,
  ecsService: frontendStack.ecsService,
  lambdaFunctions: computeStack.lambdaFunctions,
});

// Stack dependencies
storageStack.addDependency(networkStack);
computeStack.addDependency(storageStack);
computeStack.addDependency(authStack);
apiStack.addDependency(computeStack);
frontendStack.addDependency(apiStack);
monitoringStack.addDependency(frontendStack);
cicdStack.addDependency(frontendStack);

app.synth();