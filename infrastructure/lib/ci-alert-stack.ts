import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export class CIAlertStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const insightsTable = new dynamodb.Table(this, 'InsightsTable', {
      partitionKey: { name: 'molecule', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const watchlistTable = new dynamodb.Table(this, 'WatchlistTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'molecule', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userSettingsTable = new dynamodb.Table(this, 'UserSettingsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // S3 Buckets
    const dataBucket = new s3.Bucket(this, 'DataBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{
        enabled: true,
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(30),
        }],
      }],
    });

    // SQS Queue
    const eventQueue = new sqs.Queue(this, 'EventQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
    });

    const userPoolClient = userPool.addClient('AppClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    // Lambda Execution Role
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    insightsTable.grantReadWriteData(lambdaRole);
    watchlistTable.grantReadWriteData(lambdaRole);
    userSettingsTable.grantReadWriteData(lambdaRole);
    dataBucket.grantReadWrite(lambdaRole);
    eventQueue.grantSendMessages(lambdaRole);
    eventQueue.grantConsumeMessages(lambdaRole);

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock-agent-runtime:InvokeAgent'],
      resources: ['*'],
    }));

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // Processor Lambda
    const processorFunction = new lambda.Function(this, 'ProcessorFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'processor.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/processing'),
      timeout: cdk.Duration.seconds(300),
      memorySize: 512,
      role: lambdaRole,
      environment: {
        INSIGHTS_TABLE: insightsTable.tableName,
        DATA_BUCKET: dataBucket.bucketName,
      },
    });

    // Ingestion Lambdas
    const pubmedFunction = new lambda.Function(this, 'PubMedFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'pubmed_ingestion.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/ingestion', {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
          ],
        },
      }),
      timeout: cdk.Duration.seconds(60),
      role: lambdaRole,
      environment: {
        QUEUE_URL: eventQueue.queueUrl,
        DATA_BUCKET: dataBucket.bucketName,
      },
    });

    const clinicalTrialsFunction = new lambda.Function(this, 'ClinicalTrialsFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'clinicaltrials_ingestion.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/ingestion', {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
          ],
        },
      }),
      timeout: cdk.Duration.seconds(60),
      role: lambdaRole,
      environment: {
        QUEUE_URL: eventQueue.queueUrl,
        DATA_BUCKET: dataBucket.bucketName,
      },
    });

    const fdaFunction = new lambda.Function(this, 'FDAFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'fda_ingestion.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/ingestion', {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
          ],
        },
      }),
      timeout: cdk.Duration.seconds(60),
      role: lambdaRole,
      environment: {
        QUEUE_URL: eventQueue.queueUrl,
        DATA_BUCKET: dataBucket.bucketName,
      },
    });

    // Daily Digest Lambda
    const digestFunction = new lambda.Function(this, 'DigestFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'daily_digest.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/notifications'),
      timeout: cdk.Duration.seconds(300),
      role: lambdaRole,
      environment: {
        INSIGHTS_TABLE: insightsTable.tableName,
        WATCHLIST_TABLE: watchlistTable.tableName,
        USER_SETTINGS_TABLE: userSettingsTable.tableName,
        FROM_EMAIL: 'noreply@example.com',
      },
    });

    // API Lambdas
    const watchlistFunction = new lambda.Function(this, 'WatchlistFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'watchlist_api.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/api'),
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
      environment: {
        WATCHLIST_TABLE: watchlistTable.tableName,
        PUBMED_FUNCTION: pubmedFunction.functionName,
        CLINICALTRIALS_FUNCTION: clinicalTrialsFunction.functionName,
        FDA_FUNCTION: fdaFunction.functionName,
      },
    });

    const insightsFunction = new lambda.Function(this, 'InsightsFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'insights_api.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/api'),
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
      environment: {
        INSIGHTS_TABLE: insightsTable.tableName,
      },
    });

    const userSettingsFunction = new lambda.Function(this, 'UserSettingsFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'user_settings_api.handler',
      code: lambda.Code.fromAsset('../lambdas/api'),
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
      environment: {
        USER_SETTINGS_TABLE: userSettingsTable.tableName,
      },
    });

    const agentFunction = new lambda.Function(this, 'AgentFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'agent_api.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/api'),
      timeout: cdk.Duration.seconds(60),
      role: lambdaRole,
      environment: {
        AGENT_ID: process.env.AGENT_ID || 'placeholder',
        AGENT_ALIAS_ID: process.env.AGENT_ALIAS_ID || 'TSTALIASID',
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'CIAlertAPI', {
      restApiName: 'CI Alert API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // Protected endpoints (require Cognito auth)
    const watchlistResource = api.root.addResource('watchlist');
    watchlistResource.addMethod('GET', new apigateway.LambdaIntegration(watchlistFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    watchlistResource.addMethod('POST', new apigateway.LambdaIntegration(watchlistFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    watchlistResource.addMethod('DELETE', new apigateway.LambdaIntegration(watchlistFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const insightsResource = api.root.addResource('insights');
    insightsResource.addMethod('GET', new apigateway.LambdaIntegration(insightsFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const userSettingsResource = api.root.addResource('user-settings');
    userSettingsResource.addMethod('GET', new apigateway.LambdaIntegration(userSettingsFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    userSettingsResource.addMethod('PUT', new apigateway.LambdaIntegration(userSettingsFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const agentResource = api.root.addResource('agent');
    agentResource.addMethod('POST', new apigateway.LambdaIntegration(agentFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // SQS Event Source for Processor Lambda
    processorFunction.addEventSource(new SqsEventSource(eventQueue, {
      batchSize: 10,
      maxBatchingWindow: cdk.Duration.seconds(5),
    }));

    // EventBridge Rule for daily ingestion (midnight UTC)
    const dailyIngestionRule = new events.Rule(this, 'DailyIngestionRule', {
      schedule: events.Schedule.cron({ hour: '0', minute: '0' }),
    });
    dailyIngestionRule.addTarget(new targets.LambdaFunction(pubmedFunction));
    dailyIngestionRule.addTarget(new targets.LambdaFunction(clinicalTrialsFunction));
    dailyIngestionRule.addTarget(new targets.LambdaFunction(fdaFunction));

    // EventBridge Rule for daily digest (9 AM UTC)
    const dailyDigestRule = new events.Rule(this, 'DailyDigestRule', {
      schedule: events.Schedule.cron({ hour: '9', minute: '0' }),
    });
    dailyDigestRule.addTarget(new targets.LambdaFunction(digestFunction));

    // Grant watchlist function permission to invoke ingestion functions
    pubmedFunction.grantInvoke(lambdaRole);
    clinicalTrialsFunction.grantInvoke(lambdaRole);
    fdaFunction.grantInvoke(lambdaRole);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: dataBucket.bucketName,
      description: 'S3 Data Bucket Name',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });
  }
}
