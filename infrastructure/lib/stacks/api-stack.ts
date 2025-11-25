import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  userPool: cognito.UserPool;
  insightsTable: dynamodb.Table;
  userSettingsTable: dynamodb.Table;
  watchlistTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  public readonly apiGateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // API Lambda execution role
    const apiLambdaRole = new iam.Role(this, 'ApiLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                props.insightsTable.tableArn,
                props.userSettingsTable.tableArn,
                props.watchlistTable.tableArn,
                `${props.insightsTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
      },
    });

    // API Lambda functions
    const watchlistApiFunction = new lambda.Function(this, 'WatchlistApiFunction', {
      functionName: 'ci-alert-watchlist-api',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'watchlist_api.handler',
      code: lambda.Code.fromAsset('../lambdas/api'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: apiLambdaRole,
      environment: {
        INSIGHTS_TABLE: props.insightsTable.tableName,
        USER_SETTINGS_TABLE: props.userSettingsTable.tableName,
        WATCHLIST_TABLE: props.watchlistTable.tableName,
        REGION: cdk.Aws.REGION,
      },
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    const insightsApiFunction = new lambda.Function(this, 'InsightsApiFunction', {
      functionName: 'ci-alert-insights-api',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'insights_api.handler',
      code: lambda.Code.fromAsset('../lambdas/api'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: apiLambdaRole,
      environment: {
        INSIGHTS_TABLE: props.insightsTable.tableName,
        USER_SETTINGS_TABLE: props.userSettingsTable.tableName,
        WATCHLIST_TABLE: props.watchlistTable.tableName,
        REGION: cdk.Aws.REGION,
      },
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    const userSettingsApiFunction = new lambda.Function(this, 'UserSettingsApiFunction', {
      functionName: 'ci-alert-user-settings-api',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'user_settings_api.handler',
      code: lambda.Code.fromAsset('../lambdas/api'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: apiLambdaRole,
      environment: {
        INSIGHTS_TABLE: props.insightsTable.tableName,
        USER_SETTINGS_TABLE: props.userSettingsTable.tableName,
        WATCHLIST_TABLE: props.watchlistTable.tableName,
        REGION: cdk.Aws.REGION,
      },
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'CIAlertAuthorizer',
    });

    // API Gateway
    this.apiGateway = new apigateway.RestApi(this, 'CIAlertApi', {
      restApiName: 'ci-alert-api',
      description: 'API for CI Alert System',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
      },
    });

    // API Resources and Methods
    const v1 = this.apiGateway.root.addResource('v1');

    // Watchlist endpoints
    const watchlist = v1.addResource('watchlist');
    watchlist.addMethod('GET', new apigateway.LambdaIntegration(watchlistApiFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    watchlist.addMethod('POST', new apigateway.LambdaIntegration(watchlistApiFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const watchlistMolecule = watchlist.addResource('{molecule}');
    watchlistMolecule.addMethod('DELETE', new apigateway.LambdaIntegration(watchlistApiFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Insights endpoints
    const insights = v1.addResource('insights');
    insights.addMethod('GET', new apigateway.LambdaIntegration(insightsApiFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const insightsMolecule = insights.addResource('{molecule}');
    insightsMolecule.addMethod('GET', new apigateway.LambdaIntegration(insightsApiFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // User settings endpoints
    const userSettings = v1.addResource('user-settings');
    userSettings.addMethod('GET', new apigateway.LambdaIntegration(userSettingsApiFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    userSettings.addMethod('PUT', new apigateway.LambdaIntegration(userSettingsApiFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.apiGateway.url,
      exportName: 'CIAlert-ApiGatewayUrl',
    });

    new cdk.CfnOutput(this, 'ApiGatewayId', {
      value: this.apiGateway.restApiId,
      exportName: 'CIAlert-ApiGatewayId',
    });
  }
}