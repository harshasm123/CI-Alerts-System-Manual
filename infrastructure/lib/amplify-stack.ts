import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface AmplifyStackProps extends cdk.StackProps {
  readonly apiUrl?: string;
  readonly userPoolId?: string;
  readonly userPoolClientId?: string;
  readonly githubToken?: string;
  readonly repositoryUrl?: string;
  readonly domainName?: string;
}

export class AmplifyStack extends cdk.Stack {
  public readonly amplifyAppUrl: string;
  public readonly amplifyAppId: string;

  constructor(scope: Construct, id: string, props?: AmplifyStackProps) {
    super(scope, id, props);

    // GitHub access token from Secrets Manager
    const githubToken = props?.githubToken 
      ? secretsmanager.Secret.fromSecretNameV2(this, 'GitHubToken', props.githubToken)
      : undefined;

    // Amplify App (without GitHub integration for now)
    const amplifyApp = new amplify.CfnApp(this, 'CIAlertAmplifyApp', {
      name: 'ci-alert-frontend',
      description: 'Pharmaceutical CI Platform - React TypeScript Frontend',
      platform: 'WEB_COMPUTE',
      
      // Build settings for React TypeScript
      buildSpec: `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/build
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*`,

      // Environment variables
      environmentVariables: [
        {
          name: 'REACT_APP_API_URL',
          value: props?.apiUrl || '',
        },
        {
          name: 'REACT_APP_USER_POOL_ID',
          value: props?.userPoolId || '',
        },
        {
          name: 'REACT_APP_USER_POOL_CLIENT_ID',
          value: props?.userPoolClientId || '',
        },
        {
          name: 'REACT_APP_REGION',
          value: this.region,
        },
      ],

      // IAM service role for Amplify
      iamServiceRole: this.createAmplifyServiceRole().roleArn,

      // Custom rules for SPA routing
      customRules: [
        {
          source: '/<*>',
          target: '/index.html',
          status: '404-200',
        },
      ],
    });

    // Main branch (manual deployment)
    const mainBranch = new amplify.CfnBranch(this, 'MainBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      enableAutoBuild: false,
      framework: 'React',
      stage: 'PRODUCTION',
    });

    this.amplifyAppUrl = `https://${mainBranch.branchName}.${amplifyApp.attrAppId}.amplifyapp.com`;

    this.amplifyAppId = amplifyApp.attrAppId;

    // Outputs
    new cdk.CfnOutput(this, 'AmplifyAppURL', {
      value: this.amplifyAppUrl,
      description: 'Amplify App URL',
      exportName: 'CIAlert-Amplify-URL',
    });

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.amplifyAppId,
      description: 'Amplify App ID',
      exportName: 'CIAlert-Amplify-AppId',
    });

    new cdk.CfnOutput(this, 'AmplifyConsoleURL', {
      value: `https://console.aws.amazon.com/amplify/home?region=${this.region}#/${this.amplifyAppId}`,
      description: 'Amplify Console URL',
    });
  }

  private createAmplifyServiceRole(): iam.Role {
    const role = new iam.Role(this, 'AmplifyServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Service role for Amplify CI Alert Frontend',
    });

    // Basic Amplify permissions
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify')
    );

    // Additional permissions for build process
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'secretsmanager:GetSecretValue',
        ],
        resources: ['*'],
      })
    );

    return role;
  }
}