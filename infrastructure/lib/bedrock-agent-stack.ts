import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface BedrockAgentStackProps extends cdk.StackProps {
  readonly knowledgeBaseId: string;
  readonly dataSourceBucket: s3.Bucket;
}

export class BedrockAgentStack extends cdk.Stack {
  public readonly agentId: string;
  public readonly agentAliasId: string;

  constructor(scope: Construct, id: string, props: BedrockAgentStackProps) {
    super(scope, id, props);

    // IAM role for Bedrock Agent
    const agentRole = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
      ]
    });

    // Lambda function for agent actions
    const actionLambda = new lambda.Function(this, 'AgentActionLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'action_handler.lambda_handler',
      code: lambda.Code.fromAsset('../lambdas/bedrock-agent'),
      timeout: cdk.Duration.seconds(60),
      environment: {
        KNOWLEDGE_BASE_ID: props.knowledgeBaseId
      }
    });

    // Grant agent role permissions to invoke Lambda
    actionLambda.grantInvoke(agentRole);

    // Bedrock Agent
    const agent = new bedrock.CfnAgent(this, 'CIAlertAgent', {
      agentName: 'ci-alert-agent',
      description: 'Pharmaceutical competitive intelligence AI agent',
      foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      instruction: `You are a pharmaceutical competitive intelligence analyst with access to comprehensive industry data.

Your role:
- Analyze competitive threats and opportunities
- Monitor regulatory developments (FDA, EMA)
- Track clinical trial progress
- Assess patent landscapes
- Provide strategic insights

Capabilities:
- Search knowledge base for relevant documents
- Query pharmaceutical databases
- Analyze market trends
- Generate competitive assessments

Always provide:
1. Data-driven insights
2. Source citations
3. Confidence levels
4. Strategic recommendations
5. Risk assessments

Be concise, accurate, and actionable in your responses.`,
      agentResourceRoleArn: agentRole.roleArn,
      idleSessionTtlInSeconds: 1800,
      
      // Knowledge bases
      knowledgeBases: [{
        knowledgeBaseId: props.knowledgeBaseId,
        description: 'Pharmaceutical research and competitive intelligence documents',
        knowledgeBaseState: 'ENABLED'
      }],

      // Action groups
      actionGroups: [{
        actionGroupName: 'pharmaceutical-actions',
        description: 'Actions for pharmaceutical competitive intelligence',
        actionGroupState: 'ENABLED',
        actionGroupExecutor: {
          lambda: actionLambda.functionArn
        },
        apiSchema: {
          payload: JSON.stringify({
            openapi: '3.0.0',
            info: {
              title: 'Pharmaceutical CI Actions',
              version: '1.0.0'
            },
            paths: {
              '/search-insights': {
                post: {
                  description: 'Search for competitive insights by molecule or therapeutic area',
                  parameters: [{
                    name: 'molecule',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' }
                  }],
                  responses: {
                    '200': {
                      description: 'Successful response',
                      content: {
                        'application/json': {
                          schema: {
                            type: 'object',
                            properties: {
                              insights: { type: 'array' },
                              count: { type: 'number' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              '/analyze-competition': {
                post: {
                  description: 'Analyze competitive landscape for a specific molecule',
                  parameters: [{
                    name: 'molecule',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' }
                  }],
                  responses: {
                    '200': {
                      description: 'Competitive analysis',
                      content: {
                        'application/json': {
                          schema: {
                            type: 'object',
                            properties: {
                              analysis: { type: 'string' },
                              competitors: { type: 'array' },
                              threats: { type: 'array' },
                              opportunities: { type: 'array' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          })
        }
      }]
    });

    // Agent alias
    const agentAlias = new bedrock.CfnAgentAlias(this, 'AgentAlias', {
      agentId: agent.attrAgentId,
      agentAliasName: 'production',
      description: 'Production alias for CI Alert Agent'
    });

    this.agentId = agent.attrAgentId;
    this.agentAliasId = agentAlias.attrAgentAliasId;

    // Outputs
    new cdk.CfnOutput(this, 'BedrockAgentId', {
      value: this.agentId,
      description: 'Bedrock Agent ID',
      exportName: 'CIAlert-BedrockAgentId'
    });

    new cdk.CfnOutput(this, 'BedrockAgentAliasId', {
      value: this.agentAliasId,
      description: 'Bedrock Agent Alias ID',
      exportName: 'CIAlert-BedrockAgentAliasId'
    });

    new cdk.CfnOutput(this, 'AgentActionLambdaArn', {
      value: actionLambda.functionArn,
      description: 'Agent Action Lambda Function ARN',
      exportName: 'CIAlert-AgentActionLambdaArn'
    });
  }
}