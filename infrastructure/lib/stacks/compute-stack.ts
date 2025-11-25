import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dataBucket: s3.Bucket;
  insightsTable: dynamodb.Table;
  userSettingsTable: dynamodb.Table;
  watchlistTable: dynamodb.Table;
  rawEventQueue: sqs.Queue;
}

export class ComputeStack extends cdk.Stack {
  public readonly lambdaFunctions: { [key: string]: lambda.Function } = {};

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // Common Lambda execution role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
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
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
              resources: [`${props.dataBucket.bucketArn}/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:ListBucket'],
              resources: [props.dataBucket.bucketArn],
            }),
          ],
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeAgent',
                'bedrock:Retrieve',
              ],
              resources: ['*'],
            }),
          ],
        }),
        SQSAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sqs:SendMessage',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
              ],
              resources: [props.rawEventQueue.queueArn],
            }),
          ],
        }),
        SESAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ses:SendEmail', 'ses:SendRawEmail'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Common environment variables
    const commonEnvVars = {
      INSIGHTS_TABLE: props.insightsTable.tableName,
      USER_SETTINGS_TABLE: props.userSettingsTable.tableName,
      WATCHLIST_TABLE: props.watchlistTable.tableName,
      DATA_BUCKET: props.dataBucket.bucketName,
      RAW_EVENT_QUEUE_URL: props.rawEventQueue.queueUrl,
      REGION: cdk.Aws.REGION,
    };

    // PubMed Ingestion Lambda
    this.lambdaFunctions.pubmedIngestion = new lambda.Function(this, 'PubMedIngestionFunction', {
      functionName: 'ci-alert-pubmed-ingestion',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'pubmed_ingestion.handler',
      code: lambda.Code.fromAsset('../lambdas/ingestion'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      role: lambdaExecutionRole,
      environment: commonEnvVars,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // Clinical Trials Ingestion Lambda
    this.lambdaFunctions.clinicalTrialsIngestion = new lambda.Function(this, 'ClinicalTrialsIngestionFunction', {
      functionName: 'ci-alert-clinical-trials-ingestion',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'clinical_trials_ingestion.handler',
      code: lambda.Code.fromAsset('../lambdas/ingestion'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      role: lambdaExecutionRole,
      environment: commonEnvVars,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // FDA Ingestion Lambda
    this.lambdaFunctions.fdaIngestion = new lambda.Function(this, 'FDAIngestionFunction', {
      functionName: 'ci-alert-fda-ingestion',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'fda_ingestion.handler',
      code: lambda.Code.fromAsset('../lambdas/ingestion'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      role: lambdaExecutionRole,
      environment: commonEnvVars,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // EMA Ingestion Lambda
    this.lambdaFunctions.emaIngestion = new lambda.Function(this, 'EMAIngestionFunction', {
      functionName: 'ci-alert-ema-ingestion',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'ema_ingestion.handler',
      code: lambda.Code.fromAsset('../lambdas/ingestion'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      role: lambdaExecutionRole,
      environment: commonEnvVars,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // WIPO Ingestion Lambda
    this.lambdaFunctions.wipoIngestion = new lambda.Function(this, 'WIPOIngestionFunction', {
      functionName: 'ci-alert-wipo-ingestion',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'wipo_ingestion.handler',
      code: lambda.Code.fromAsset('../lambdas/ingestion'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      role: lambdaExecutionRole,
      environment: commonEnvVars,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // Processor Lambda (processes SQS messages)
    this.lambdaFunctions.processor = new lambda.Function(this, 'ProcessorFunction', {
      functionName: 'ci-alert-processor',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'processor.handler',
      code: lambda.Code.fromAsset('../lambdas/processing'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      role: lambdaExecutionRole,
      environment: commonEnvVars,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // Add SQS event source to processor
    this.lambdaFunctions.processor.addEventSource(
      new lambdaEventSources.SqsEventSource(props.rawEventQueue, {
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
      })
    );

    // Daily Digest Lambda
    this.lambdaFunctions.dailyDigest = new lambda.Function(this, 'DailyDigestFunction', {
      functionName: 'ci-alert-daily-digest',
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      handler: 'daily_digest.handler',
      code: lambda.Code.fromAsset('../lambdas/notifications'),
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      role: lambdaExecutionRole,
      environment: commonEnvVars,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // EventBridge Rules for scheduled ingestion
    const pubmedRule = new events.Rule(this, 'PubMedIngestionRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      description: 'Trigger PubMed ingestion every hour',
    });
    pubmedRule.addTarget(new targets.LambdaFunction(this.lambdaFunctions.pubmedIngestion));

    const clinicalTrialsRule = new events.Rule(this, 'ClinicalTrialsIngestionRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(2)),
      description: 'Trigger Clinical Trials ingestion every 2 hours',
    });
    clinicalTrialsRule.addTarget(new targets.LambdaFunction(this.lambdaFunctions.clinicalTrialsIngestion));

    const fdaRule = new events.Rule(this, 'FDAIngestionRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(4)),
      description: 'Trigger FDA ingestion every 4 hours',
    });
    fdaRule.addTarget(new targets.LambdaFunction(this.lambdaFunctions.fdaIngestion));

    const emaRule = new events.Rule(this, 'EMAIngestionRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(6)),
      description: 'Trigger EMA ingestion every 6 hours',
    });
    emaRule.addTarget(new targets.LambdaFunction(this.lambdaFunctions.emaIngestion));

    const wipoRule = new events.Rule(this, 'WIPOIngestionRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(12)),
      description: 'Trigger WIPO ingestion every 12 hours',
    });
    wipoRule.addTarget(new targets.LambdaFunction(this.lambdaFunctions.wipoIngestion));

    // Daily digest at 9 AM UTC (adjust timezone as needed)
    const dailyDigestRule = new events.Rule(this, 'DailyDigestRule', {
      schedule: events.Schedule.cron({ hour: '9', minute: '0' }),
      description: 'Trigger daily digest at 9 AM',
    });
    dailyDigestRule.addTarget(new targets.LambdaFunction(this.lambdaFunctions.dailyDigest));

    // Outputs
    Object.entries(this.lambdaFunctions).forEach(([name, func]) => {
      new cdk.CfnOutput(this, `${name}FunctionArn`, {
        value: func.functionArn,
        exportName: `CIAlert-${name}FunctionArn`,
      });
    });
  }
}