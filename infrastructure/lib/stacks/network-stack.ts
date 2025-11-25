import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with private subnets only (cost optimization - no NAT Gateway)
    this.vpc = new ec2.Vpc(this, 'CIAlertVPC', {
      maxAzs: 2,
      natGateways: 0, // Cost optimization
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // VPC Endpoints for cost optimization (instead of NAT Gateway)
    const s3Endpoint = this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    const dynamoEndpoint = this.vpc.addGatewayEndpoint('DynamoEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Interface endpoints for other services
    const bedrockEndpoint = this.vpc.addInterfaceEndpoint('BedrockEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
      privateDnsEnabled: true,
    });

    const sqsEndpoint = this.vpc.addInterfaceEndpoint('SQSEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      privateDnsEnabled: true,
    });

    const sesEndpoint = this.vpc.addInterfaceEndpoint('SESEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SES,
      privateDnsEnabled: true,
    });

    const eventsEndpoint = this.vpc.addInterfaceEndpoint('EventsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.EVENTBRIDGE,
      privateDnsEnabled: true,
    });

    // Security group for Lambda functions
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Security group for ECS tasks
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS tasks',
    });

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3000),
      'Allow HTTP traffic to React app'
    );

    // Export security groups
    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: lambdaSecurityGroup.securityGroupId,
      exportName: 'CIAlert-LambdaSecurityGroupId',
    });

    new cdk.CfnOutput(this, 'ECSSecurityGroupId', {
      value: ecsSecurityGroup.securityGroupId,
      exportName: 'CIAlert-ECSSecurityGroupId',
    });

    // Export VPC details
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: 'CIAlert-VpcId',
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      exportName: 'CIAlert-PrivateSubnetIds',
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: this.vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      exportName: 'CIAlert-PublicSubnetIds',
    });
  }
}