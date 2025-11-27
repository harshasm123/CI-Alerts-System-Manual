import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class BedrockAgentStack extends cdk.Stack {
  public readonly agentId: string;
  public readonly agentAliasId: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get table names from environment or use defaults
    const insightsTableName = process.env.INSIGHTS_TABLE || 'CIAlertStack-InsightsTable';
    const watchlistTableName = process.env.WATCHLIST_TABLE || 'CIAlertStack-WatchlistTable';

    // Import existing tables
    const insightsTable = dynamodb.Table.fromTableName(this, 'InsightsTable', insightsTableName);
    const watchlistTable = dynamodb.Table.fromTableName(this, 'WatchlistTable', watchlistTableName);

    // S3 bucket for knowledge base
    const knowledgeBaseBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // IAM role for Bedrock Agent
    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
      ],
    });

    // Action Lambda
    const actionLambda = new lambda.Function(this, 'ActionLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'action_handler.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/bedrock-agent'),
      timeout: cdk.Duration.seconds(60),
      environment: {
        INSIGHTS_TABLE: insightsTable.tableName,
        WATCHLIST_TABLE: watchlistTable.tableName,
      },
    });

    insightsTable.grantReadData(actionLambda);
    watchlistTable.grantReadData(actionLambda);

    // Grant Bedrock Agent permission to invoke Lambda
    actionLambda.grantInvoke(agentRole);

    // Create Bedrock Agent
    const agent = new bedrock.CfnAgent(this, 'Agent', {
      agentName: 'ci-alert-agent',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'amazon.nova-pro-v1:0',
      instruction: `You are a pharmaceutical competitive intelligence analyst assistant.

Your role:
- Analyze drug development news and clinical trials
- Identify competitive threats and opportunities
- Track FDA approvals and regulatory changes
- Provide strategic recommendations
- Answer questions about molecules and insights

Available actions:
- query_insights: Get insights for a specific molecule
- analyze_trends: Analyze sentiment trends over time
- compare_molecules: Compare two molecules

Be concise, data-driven, and highlight high-impact events.`,
      idleSessionTtlInSeconds: 600,
    });

    // Action Group
    const actionGroup = new bedrock.CfnAgentActionGroup(this, 'ActionGroup', {
      agentId: agent.attrAgentId,
      agentVersion: 'DRAFT',
      actionGroupName: 'ci-alert-actions',
      actionGroupExecutor: {
        lambda: actionLambda.functionArn,
      },
      actionGroupState: 'ENABLED',
      apiSchema: {
        payload: JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: 'CI Alert Actions',
            version: '1.0.0',
          },
          paths: {
            '/query-insights': {
              post: {
                description: 'Query insights for a specific molecule',
                operationId: 'queryInsights',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          molecule: { type: 'string' },
                          limit: { type: 'integer', default: 10 },
                        },
                        required: ['molecule'],
                      },
                    },
                  },
                },
              },
            },
            '/analyze-trends': {
              post: {
                description: 'Analyze sentiment trends for a molecule',
                operationId: 'analyzeTrends',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          molecule: { type: 'string' },
                          days: { type: 'integer', default: 30 },
                        },
                        required: ['molecule'],
                      },
                    },
                  },
                },
              },
            },
            '/compare-molecules': {
              post: {
                description: 'Compare two molecules',
                operationId: 'compareMolecules',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          molecule1: { type: 'string' },
                          molecule2: { type: 'string' },
                        },
                        required: ['molecule1', 'molecule2'],
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      },
    });

    // Prepare Agent
    const agentPrepare = new bedrock.CfnAgent(this, 'AgentPrepare', {
      agentId: agent.attrAgentId,
    });
    agentPrepare.node.addDependency(actionGroup);

    // Agent Alias
    const agentAlias = new bedrock.CfnAgentAlias(this, 'AgentAlias', {
      agentId: agent.attrAgentId,
      agentAliasName: 'production',
    });
    agentAlias.node.addDependency(agentPrepare);

    this.agentId = agent.attrAgentId;
    this.agentAliasId = agentAlias.attrAgentAliasId;

    // Outputs
    new cdk.CfnOutput(this, 'AgentIdOutput', {
      value: agent.attrAgentId,
      description: 'Bedrock Agent ID',
    });

    new cdk.CfnOutput(this, 'AgentAliasIdOutput', {
      value: agentAlias.attrAgentAliasId,
      description: 'Bedrock Agent Alias ID',
    });
  }
}
