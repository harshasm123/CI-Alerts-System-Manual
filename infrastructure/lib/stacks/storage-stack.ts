import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly insightsTable: dynamodb.Table;
  public readonly userSettingsTable: dynamodb.Table;
  public readonly watchlistTable: dynamodb.Table;
  public readonly dataBucket: s3.Bucket;
  public readonly rawEventQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    this.insightsTable = new dynamodb.Table(this, 'InsightsTable', {
      tableName: 'ci-alert-insights',
      partitionKey: { name: 'insight_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.ON_DEMAND,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for molecule-based queries
    this.insightsTable.addGlobalSecondaryIndex({
      indexName: 'molecule-timestamp-index',
      partitionKey: { name: 'molecule', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    this.userSettingsTable = new dynamodb.Table(this, 'UserSettingsTable', {
      tableName: 'ci-alert-user-settings',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.ON_DEMAND,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.watchlistTable = new dynamodb.Table(this, 'WatchlistTable', {
      tableName: 'ci-alert-watchlist',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'molecule', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.ON_DEMAND,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // S3 Bucket for data storage
    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `ci-alert-data-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'intelligent-tiering',
          status: s3.LifecycleRuleStatus.ENABLED,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(1),
            },
          ],
        },
        {
          id: 'archive-old-data',
          status: s3.LifecycleRuleStatus.ENABLED,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // SQS Queue for raw events
    const deadLetterQueue = new sqs.Queue(this, 'RawEventDLQ', {
      queueName: 'ci-alert-raw-events-dlq',
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.rawEventQueue = new sqs.Queue(this, 'RawEventQueue', {
      queueName: 'ci-alert-raw-events',
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'InsightsTableName', {
      value: this.insightsTable.tableName,
      exportName: 'CIAlert-InsightsTableName',
    });

    new cdk.CfnOutput(this, 'UserSettingsTableName', {
      value: this.userSettingsTable.tableName,
      exportName: 'CIAlert-UserSettingsTableName',
    });

    new cdk.CfnOutput(this, 'WatchlistTableName', {
      value: this.watchlistTable.tableName,
      exportName: 'CIAlert-WatchlistTableName',
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      exportName: 'CIAlert-DataBucketName',
    });

    new cdk.CfnOutput(this, 'RawEventQueueUrl', {
      value: this.rawEventQueue.queueUrl,
      exportName: 'CIAlert-RawEventQueueUrl',
    });
  }
}