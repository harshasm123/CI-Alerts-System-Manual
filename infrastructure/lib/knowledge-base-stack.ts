import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

export class KnowledgeBaseStack extends cdk.Stack {
  public readonly knowledgeBaseId: string;
  public readonly dataSourceBucket: s3.Bucket;
  public readonly opensearchCollection: opensearch.CfnCollection;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for knowledge base documents
    this.dataSourceBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
    });

    // OpenSearch Serverless Collection
    const collectionName = 'ci-alert-knowledge-base';
    
    // Security policy for OpenSearch Serverless
    const securityPolicy = new opensearch.CfnSecurityPolicy(this, 'SecurityPolicy', {
      name: `${collectionName}-security-policy`,
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [{
          ResourceType: 'collection',
          Resource: [`collection/${collectionName}`]
        }],
        AWSOwnedKey: true
      })
    });

    // Network policy
    const networkPolicy = new opensearch.CfnNetworkPolicy(this, 'NetworkPolicy', {
      name: `${collectionName}-network-policy`,
      type: 'network',
      policy: JSON.stringify([{
        Rules: [{
          ResourceType: 'collection',
          Resource: [`collection/${collectionName}`]
        }, {
          ResourceType: 'dashboard',
          Resource: [`collection/${collectionName}`]
        }],
        AllowFromPublic: true
      }])
    });

    // OpenSearch Serverless Collection
    this.opensearchCollection = new opensearch.CfnCollection(this, 'Collection', {
      name: collectionName,
      description: 'Knowledge base for pharmaceutical CI system',
      type: 'VECTORSEARCH'
    });
    
    this.opensearchCollection.addDependency(securityPolicy);
    this.opensearchCollection.addDependency(networkPolicy);

    // IAM role for Bedrock Knowledge Base
    const knowledgeBaseRole = new iam.Role(this, 'KnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
      ]
    });

    // Grant permissions to S3 bucket
    this.dataSourceBucket.grantReadWrite(knowledgeBaseRole);

    // Grant permissions to OpenSearch
    knowledgeBaseRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'aoss:APIAccessAll'
      ],
      resources: [this.opensearchCollection.attrArn]
    }));

    // Bedrock Knowledge Base
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: 'ci-alert-knowledge-base',
      description: 'Pharmaceutical competitive intelligence knowledge base',
      roleArn: knowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`
        }
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: this.opensearchCollection.attrArn,
          vectorIndexName: 'ci-alert-index',
          fieldMapping: {
            vectorField: 'vector',
            textField: 'text',
            metadataField: 'metadata'
          }
        }
      }
    });

    knowledgeBase.addDependency(this.opensearchCollection);

    // Data source
    new bedrock.CfnDataSource(this, 'DataSource', {
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      name: 'pharmaceutical-documents',
      description: 'Pharmaceutical documents and research papers',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: this.dataSourceBucket.bucketArn,
          inclusionPrefixes: ['documents/']
        }
      }
    });

    this.knowledgeBaseId = knowledgeBase.attrKnowledgeBaseId;

    // Outputs
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBaseId,
      description: 'Bedrock Knowledge Base ID',
      exportName: 'CIAlert-KnowledgeBaseId'
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseBucketName', {
      value: this.dataSourceBucket.bucketName,
      description: 'Knowledge Base S3 Bucket Name',
      exportName: 'CIAlert-KnowledgeBaseBucket'
    });

    new cdk.CfnOutput(this, 'OpenSearchCollectionEndpoint', {
      value: this.opensearchCollection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless Collection Endpoint',
      exportName: 'CIAlert-OpenSearchEndpoint'
    });
  }
}