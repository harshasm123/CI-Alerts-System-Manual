import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import { Construct } from 'constructs';

export class KnowledgeBaseStack extends cdk.Stack {
  public readonly knowledgeBaseId: string;
  public readonly dataSourceBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for knowledge base documents
    this.dataSourceBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
      bucketName: `ci-alert-kb-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioningConfiguration: { status: 'Enabled' },
      lifecycleRules: [{
        id: 'DeleteOldVersions',
        noncurrentVersionExpiration: cdk.Duration.days(30),
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // OpenSearch Serverless collection for vector storage
    const vectorCollection = new opensearch.CfnCollection(this, 'VectorCollection', {
      name: 'ci-alert-vectors',
      type: 'VECTORSEARCH',
      description: 'Vector collection for CI Alert knowledge base',
    });

    // Network policy for OpenSearch Serverless
    new opensearch.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: 'ci-alert-network-policy',
      type: 'network',
      policy: JSON.stringify([{
        Rules: [{
          Resource: [`collection/${vectorCollection.name}`],
          ResourceType: 'collection'
        }],
        AllowFromPublic: true
      }])
    });

    // Encryption policy for OpenSearch Serverless
    new opensearch.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: 'ci-alert-encryption-policy',
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [{
          Resource: [`collection/${vectorCollection.name}`],
          ResourceType: 'collection'
        }],
        AWSOwnedKey: true
      })
    });

    // Data access policy for OpenSearch Serverless
    new opensearch.CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: 'ci-alert-data-policy',
      type: 'data',
      policy: JSON.stringify([{
        Rules: [{
          Resource: [`collection/${vectorCollection.name}`],
          Permission: ['aoss:CreateCollectionItems', 'aoss:DeleteCollectionItems', 'aoss:UpdateCollectionItems', 'aoss:DescribeCollectionItems'],
          ResourceType: 'collection'
        }, {
          Resource: [`index/${vectorCollection.name}/*`],
          Permission: ['aoss:CreateIndex', 'aoss:DeleteIndex', 'aoss:UpdateIndex', 'aoss:DescribeIndex', 'aoss:ReadDocument', 'aoss:WriteDocument'],
          ResourceType: 'index'
        }],
        Principal: [`arn:aws:iam::${this.account}:root`]
      }])
    });

    // IAM role for Bedrock Knowledge Base
    const knowledgeBaseRole = new iam.Role(this, 'KnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:ListBucket'],
              resources: [
                this.dataSourceBucket.bucketArn,
                `${this.dataSourceBucket.bucketArn}/*`
              ]
            })
          ]
        }),
        OpenSearchAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['aoss:APIAccessAll'],
              resources: [vectorCollection.attrArn]
            })
          ]
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel'],
              resources: ['arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1']
            })
          ]
        })
      }
    });

    // Bedrock Knowledge Base
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: 'ci-alert-knowledge-base',
      description: 'Pharmaceutical competitive intelligence knowledge base',
      roleArn: knowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1'
        }
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: vectorCollection.attrArn,
          vectorIndexName: 'ci-alert-index',
          fieldMapping: {
            vectorField: 'vector',
            textField: 'text',
            metadataField: 'metadata'
          }
        }
      }
    });

    // Data source for knowledge base
    const dataSource = new bedrock.CfnDataSource(this, 'DataSource', {
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      name: 'ci-alert-documents',
      description: 'S3 data source for pharmaceutical documents',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: this.dataSourceBucket.bucketArn,
          inclusionPrefixes: ['documents/']
        }
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: 512,
            overlapPercentage: 20
          }
        }
      }
    });

    this.knowledgeBaseId = knowledgeBase.attrKnowledgeBaseId;

    // Outputs
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: knowledgeBase.attrKnowledgeBaseId,
      description: 'Bedrock Knowledge Base ID',
      exportName: 'KnowledgeBaseId'
    });

    new cdk.CfnOutput(this, 'DataSourceId', {
      value: dataSource.attrDataSourceId,
      description: 'Bedrock Data Source ID',
      exportName: 'DataSourceId'
    });

    new cdk.CfnOutput(this, 'DataSourceBucket', {
      value: this.dataSourceBucket.bucketName,
      description: 'S3 bucket for knowledge base documents'
    });

    new cdk.CfnOutput(this, 'VectorCollectionEndpoint', {
      value: vectorCollection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint'
    });
  }
}