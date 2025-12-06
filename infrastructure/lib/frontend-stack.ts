import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';
import { Construct } from 'constructs';

export class FrontendStack extends cdk.Stack {
  public readonly loadBalancerUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC - use default VPC or create new one
    const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
      isDefault: true,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'FrontendCluster', {
      vpc,
      clusterName: 'ci-alert-frontend-cluster',
    });

    // Build Docker image from frontend directory
    const frontendImage = new ecr_assets.DockerImageAsset(this, 'FrontendImage', {
      directory: path.join(__dirname, '../../frontend'),
      file: 'Dockerfile',
    });

    // Fargate Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'FrontendTask', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    // Add container to task
    const container = taskDefinition.addContainer('FrontendContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(frontendImage),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'frontend' }),
      environment: {
        REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'https://api.example.com/',
        REACT_APP_USER_POOL_ID: process.env.REACT_APP_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
        REACT_APP_USER_POOL_CLIENT_ID: process.env.REACT_APP_USER_POOL_CLIENT_ID || 'xxxxxxxxxx',
        REACT_APP_REGION: process.env.REACT_APP_REGION || this.region,
      },
    });

    container.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    // Fargate Service
    const service = new ecs.FargateService(this, 'FrontendService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'FrontendALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'ci-alert-frontend-alb',
    });

    // HTTP Listener (port 80)
    const httpListener = alb.addListener('HttpListener', {
      port: 80,
      open: true,
    });

    // Target Group
    httpListener.addTargets('FrontendTarget', {
      port: 80,
      targets: [service],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    this.loadBalancerUrl = `http://${alb.loadBalancerDnsName}`;

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerURL', {
      value: this.loadBalancerUrl,
      description: 'Application Load Balancer URL',
      exportName: 'CIAlert-LoadBalancerURL',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
      exportName: 'CIAlert-ALB-DNS',
    });
  }
}
