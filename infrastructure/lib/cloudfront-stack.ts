import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

export interface CloudFrontStackProps extends cdk.StackProps {
  userPoolId: string;
  userPoolClientId: string;
  apiUrl: string;
  region: string;
}

export class CloudFrontStack extends cdk.Stack {
  public readonly appUrl: string;
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);

    // S3 bucket for frontend with logging
    const logBucket = new s3.Bucket(this, 'LogBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{
        enabled: true,
        expiration: cdk.Duration.days(90),
      }],
    });

    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `ci-alert-frontend-${cdk.Aws.ACCOUNT_ID}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 'frontend-access/',
    });

    // CloudFront Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for CI Alert Frontend',
    });

    this.bucket.grantRead(oai);

    // CloudFront distribution with security headers and logging
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
          securityHeadersBehavior: {
            contentTypeOptions: { override: true },
            frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
            referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
            strictTransportSecurity: { accessControlMaxAge: cdk.Duration.seconds(31536000), includeSubdomains: true, override: true },
            xssProtection: { protection: true, modeBlock: true, override: true },
          },
        }),
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      enableLogging: true,
      logBucket: logBucket,
      logFilePrefix: 'cloudfront/',
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Deploy frontend (if build exists)
    const frontendPath = path.join(__dirname, '../../frontend/build');
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(frontendPath)],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    this.appUrl = `https://${this.distribution.distributionDomainName}`;

    // Outputs
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: this.appUrl,
      description: 'CloudFront Distribution URL',
      exportName: 'CIAlert-CloudFront-URL',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket Name',
      exportName: 'CIAlert-S3-Bucket',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: 'CIAlert-CloudFront-DistId',
    });

    new cdk.CfnOutput(this, 'ConfigInfo', {
      value: JSON.stringify({
        userPoolId: props.userPoolId,
        userPoolClientId: props.userPoolClientId,
        apiUrl: props.apiUrl,
        region: props.region,
      }),
      description: 'Frontend Configuration',
    });
  }
}
