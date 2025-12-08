import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as logs from 'aws-cdk-lib/aws-logs';

import * as path from 'path';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  readonly domainName?: string;
  readonly certificateArn?: string;

  readonly apiUrl?: string;
  readonly userPoolId?: string;
  readonly userPoolClientId?: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly loadBalancerUrl: string;
  public readonly albDnsName: string;


  constructor(scope: Construct, id: string, props?: FrontendStackProps) {
    super(scope, id, props);

    // Create VPC for production-grade deployment
    const vpc = new ec2.Vpc(this, 'FrontendVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // ECS Cluster with container insights
    const cluster = new ecs.Cluster(this, 'FrontendCluster', {
      vpc,
      clusterName: 'ci-alert-frontend-cluster',
      containerInsights: true,
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'FrontendLogGroup', {
      logGroupName: '/ecs/ci-alert-frontend',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Build Docker image from frontend directory
    const frontendImage = new ecr_assets.DockerImageAsset(this, 'FrontendImage', {
      directory: path.join(__dirname, '../../frontend'),
      file: 'Dockerfile',
    });

    // Fargate Task Definition with proper resource allocation
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'FrontendTask', {
      memoryLimitMiB: 1024,
      cpu: 512,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
      },
    });

    // Add container to task with production configuration
    const container = taskDefinition.addContainer('FrontendContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(frontendImage),
      logging: ecs.LogDrivers.awsLogs({ 
        logGroup,
        streamPrefix: 'frontend',
      }),
      environment: {
        REACT_APP_API_URL: props?.apiUrl || 'https://api.example.com/',
        REACT_APP_USER_POOL_ID: props?.userPoolId || 'us-east-1_XXXXXXXXX',
        REACT_APP_USER_POOL_CLIENT_ID: props?.userPoolClientId || 'xxxxxxxxxx',
        REACT_APP_REGION: this.region,
        NODE_ENV: 'production',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // Fargate Service with auto-scaling
    const service = new ecs.FargateService(this, 'FrontendService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      assignPublicIp: false, // Deploy in private subnets
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      enableExecuteCommand: true, // For debugging
    });

    // Auto Scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
    });

    // Application Load Balancer with security groups
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for CI Alert ALB',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    const alb = new elbv2.ApplicationLoadBalancer(this, 'FrontendALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'ci-alert-frontend-alb',
      securityGroup: albSecurityGroup,
      deletionProtection: false, // Set to true in production
    });

    // Target Group with advanced health checks
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'FrontendTargetGroup', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    targetGroup.addTarget(service);

    // HTTP Listener (redirects to HTTPS if certificate available)
    const httpListener = alb.addListener('HttpListener', {
      port: 80,
      open: true,
      defaultAction: props?.certificateArn
        ? elbv2.ListenerAction.redirect({
            protocol: 'HTTPS',
            port: '443',
            permanent: true,
          })
        : elbv2.ListenerAction.forward([targetGroup]),
    });

    // HTTPS Listener (if certificate provided)
    if (props?.certificateArn) {
      const certificate = certificatemanager.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn
      );

      alb.addListener('HttpsListener', {
        port: 443,
        certificates: [certificate],
        defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      });
    }

    // WAF Web ACL for security
    const webAcl = new wafv2.CfnWebACL(this, 'FrontendWebACL', {
      scope: 'REGIONAL',
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
          name: 'RateLimitRule',
          priority: 2,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitMetric',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'FrontendWebACL',
      },
    });

    // Associate WAF with ALB
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      resourceArn: alb.loadBalancerArn,
      webAclArn: webAcl.attrArn,
    });

    this.albDnsName = alb.loadBalancerDnsName;
    this.loadBalancerUrl = props?.domainName
      ? `https://${props.domainName}`
      : props?.certificateArn
      ? `https://${alb.loadBalancerDnsName}`
      : `http://${alb.loadBalancerDnsName}`;

    // Route53 DNS (if domain provided)
    if (props?.domainName) {
      const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: props.domainName.split('.').slice(-2).join('.'), // Get root domain
      });

      new route53.ARecord(this, 'AliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(
          new route53targets.LoadBalancerTarget(alb)
        ),
      });
    }

    // CloudFront distribution for production-grade global delivery
    const cloudFrontOriginAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'CloudFrontOAI',
      {
        comment: 'CI Alert Frontend CloudFront OAI',
      }
    );

    // CloudFront WAF Web ACL
    const cloudfrontWebAcl = new wafv2.CfnWebACL(this, 'CloudFrontWebACL', {
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
            metricName: 'CloudFrontCommonRuleSet',
          },
        },
        {
          name: 'RateLimitRule',
          priority: 2,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 5000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CloudFrontRateLimit',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'CloudFrontWebACL',
      },
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Frontend', {
      defaultBehavior: {
        origin: new cloudfrontOrigins.HttpOrigin(alb.loadBalancerDnsName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          customHeaders: {
            'X-Origin-Verify': 'CloudFront-Distribution',
          },
        }),
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },
      // Security and performance settings
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      enabled: true,
      enableIpv6: true,
      enableLogging: true,
      logBucket: undefined, // Use default CloudFront logging
      logFilePrefix: 'cloudfront-logs/',

      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // North America, Europe, Asia
      webAclId: cloudfrontWebAcl.attrArn,
      // Caching and compression
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Custom domain if provided
      domainNames: props?.domainName ? [props.domainName] : undefined,
      certificate: props?.cloudFrontCertificateArn
        ? certificatemanager.Certificate.fromCertificateArn(
            this,
            'CloudFrontCertificate',
            props.cloudFrontCertificateArn
          )
        : undefined,
    });

    // Add cache behaviors for different content types
    distribution.addBehavior('*.js', 
      new cloudfrontOrigins.HttpOrigin(alb.loadBalancerDnsName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      }),
      {
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      }
    );

    distribution.addBehavior('*.css',
      new cloudfrontOrigins.HttpOrigin(alb.loadBalancerDnsName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      }),
      {
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      }
    );

    distribution.addBehavior('/api/*',
      new cloudfrontOrigins.HttpOrigin(alb.loadBalancerDnsName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      }),
      {
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      }
    );

    this.cloudFrontDomainName = distribution.domainName;
    this.cloudFrontUrl = props?.domainName
      ? `https://${props.domainName}`
      : `https://${distribution.domainName}`;

    // Route53 record for CloudFront if domain provided
    if (props?.domainName && props?.cloudFrontCertificateArn) {
      const hostedZone = route53.HostedZone.fromLookup(this, 'CloudFrontHostedZone', {
        domainName: props.domainName.split('.').slice(-2).join('.'),
      });

      new route53.ARecord(this, 'CloudFrontAliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(distribution)
        ),
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerURL', {
      value: this.loadBalancerUrl,
      description: 'Application Load Balancer URL',
      exportName: 'CIAlert-LoadBalancerURL',
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: this.cloudFrontUrl,
      description: 'CloudFront Distribution URL (Recommended)',
      exportName: 'CIAlert-CloudFront-URL',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.cloudFrontDomainName,
      description: 'CloudFront Domain Name',
      exportName: 'CIAlert-CloudFront-Domain',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
      exportName: 'CIAlert-ALB-DNS',
    });

    new cdk.CfnOutput(this, 'VPCId', {
      value: vpc.vpcId,
      description: 'VPC ID',
      exportName: 'CIAlert-VPC-ID',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: 'CIAlert-Cluster-Name',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
      description: 'ECS Service Name',
      exportName: 'CIAlert-Service-Name',
    });
  }
}
