import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
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

    // Placeholder agent IDs (manual setup required)
    this.agentId = 'manual-setup-required';
    this.agentAliasId = 'manual-setup-required';

    // Outputs
    new cdk.CfnOutput(this, 'BedrockAgentId', {
      value: this.agentId,
      description: 'Bedrock Agent ID (Manual Setup Required)',
      exportName: 'CIAlert-BedrockAgentId'
    });

    new cdk.CfnOutput(this, 'BedrockAgentAliasId', {
      value: this.agentAliasId,
      description: 'Bedrock Agent Alias ID (Manual Setup Required)',
      exportName: 'CIAlert-BedrockAgentAliasId'
    });

    new cdk.CfnOutput(this, 'AgentActionLambdaArn', {
      value: actionLambda.functionArn,
      description: 'Agent Action Lambda Function ARN',
      exportName: 'CIAlert-AgentActionLambdaArn'
    });

    new cdk.CfnOutput(this, 'ManualSetupInstructions', {
      value: 'Create Bedrock Agent manually in AWS Console and connect to Lambda',
      description: 'Manual Setup Instructions',
    });
  }
}