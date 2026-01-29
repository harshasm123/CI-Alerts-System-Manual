import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface BedrockAgentStackProps extends cdk.StackProps {
  readonly knowledgeBaseId: string;
  readonly dataSourceBucket: s3.Bucket;
}

export class BedrockAgentStack extends cdk.Stack {
  public readonly agentId: string;

  constructor(scope: Construct, id: string, props: BedrockAgentStackProps) {
    super(scope, id, props);

    this.agentId = 'placeholder-agent-id';

    new cdk.CfnOutput(this, 'BedrockAgentId', {
      value: this.agentId,
      description: 'Bedrock Agent ID',
    });
  }
}