import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class KnowledgeBaseStack extends cdk.Stack {
  public readonly knowledgeBaseId: string;
  public readonly dataSourceBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for knowledge base documents
    this.dataSourceBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
    });

    // Placeholder knowledge base ID (manual setup required)
    this.knowledgeBaseId = 'manual-setup-required';

    // Outputs
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBaseId,
      description: 'Bedrock Knowledge Base ID (Manual Setup Required)',
      exportName: 'CIAlert-KnowledgeBaseId'
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseBucketName', {
      value: this.dataSourceBucket.bucketName,
      description: 'Knowledge Base S3 Bucket Name',
      exportName: 'CIAlert-KnowledgeBaseBucket'
    });

    new cdk.CfnOutput(this, 'ManualSetupInstructions', {
      value: 'Create Knowledge Base manually in AWS Console using this S3 bucket',
      description: 'Manual Setup Instructions',
    });
  }
}