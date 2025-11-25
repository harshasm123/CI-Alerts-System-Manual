import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  apiGateway: apigateway.RestApi;
}

export class FrontendStack extends cdk.Stack {
  public readonly ecsService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // ECR Repository for React app
    const ecrRepository = new ecr.Repository(this, 'CIAlertECRRepo', {
      repositoryName: 'ci-alert-frontend',
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 images',
        },
      ],
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'CIAlertCluster', {
      clusterName: 'ci-alert-cluster',
      vpc: props.vpc,
      containerInsights: true,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'CIAlertTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    // Log Group
    const logGroup = new logs.LogGroup(this, 'CIAlertLogGroup', {
      logGroupName: '/ecs/ci-alert-frontend',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Container Definition
    const container = taskDefinition.addContainer('CIAlertContainer', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ci-alert',
        logGroup: logGroup,
      }),
      environment: {
        REACT_APP_USER_POOL_ID: props.userPool.userPoolId,
        REACT_APP_USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
        REACT_APP_API_GATEWAY_URL: props.apiGateway.url,
        REACT_APP_REGION: cdk.Aws.REGION,
      },
      portMappings: [
        {
          containerPort: 3000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'CIAlertALB', {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: 'ci-alert-alb',
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'CIAlertTargetGroup', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // ALB Listener
    const listener = alb.addListener('CIAlertListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // ECS Service
    this.ecsService = new ecs.FargateService(this, 'CIAlertService', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      serviceName: 'ci-alert-service',
      desiredCount: 2,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Attach service to target group
    this.ecsService.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling
    const scaling = this.ecsService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(300),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(300),
    });

    // WAF Web ACL
    const webAcl = new wafv2.CfnWebACL(this, 'CIAlertWebACL', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsRuleSetMetric',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'CIAlertWebACL',
      },
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'CIAlertDistribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      webAclId: webAcl.attrArn,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ECRRepositoryUri', {
      value: ecrRepository.repositoryUri,
      exportName: 'CIAlert-ECRRepositoryUri',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      exportName: 'CIAlert-LoadBalancerDNS',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
      exportName: 'CIAlert-CloudFrontDomainName',
    });

    new cdk.CfnOutput(this, 'ECSClusterName', {
      value: cluster.clusterName,
      exportName: 'CIAlert-ECSClusterName',
    });

    new cdk.CfnOutput(this, 'ECSServiceName', {
      value: this.ecsService.serviceName,
      exportName: 'CIAlert-ECSServiceName',
    });
  }
}