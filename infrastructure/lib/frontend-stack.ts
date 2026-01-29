import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  readonly apiUrl?: string;
  readonly userPoolId?: string;
  readonly userPoolClientId?: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly frontendUrl: string;
  public readonly bucketName: string;

  constructor(scope: Construct, id: string, props?: FrontendStackProps) {
    super(scope, id, props);

    // S3 bucket for hosting React app
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `ci-alert-frontend-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    this.frontendUrl = `https://${distribution.distributionDomainName}`;
    this.bucketName = websiteBucket.bucketName;

    // Outputs
    new cdk.CfnOutput(this, 'FrontendURL', {
      value: this.frontendUrl,
      description: 'Frontend Application URL',
      exportName: 'CIAlert-Frontend-URL',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucketName,
      description: 'S3 Bucket for Frontend',
      exportName: 'CIAlert-Frontend-Bucket',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}