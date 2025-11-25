import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'CIAlertUserPool', {
      userPoolName: 'ci-alert-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Optional MFA configuration
    this.userPool.addDomain('CIAlertDomain', {
      cognitoDomain: {
        domainPrefix: `ci-alert-${cdk.Aws.ACCOUNT_ID}`,
      },
    });

    // User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'CIAlertUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'ci-alert-web-client',
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3000/callback',
          'https://ci-alert.example.com/callback', // Update with actual domain
        ],
        logoutUrls: [
          'http://localhost:3000',
          'https://ci-alert.example.com', // Update with actual domain
        ],
      },
      preventUserExistenceErrors: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'CIAlert-UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: 'CIAlert-UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `ci-alert-${cdk.Aws.ACCOUNT_ID}.auth.${cdk.Aws.REGION}.amazoncognito.com`,
      exportName: 'CIAlert-UserPoolDomain',
    });
  }
}