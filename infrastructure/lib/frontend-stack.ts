import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { Construct } from 'constructs';

export class FrontendStack extends cdk.Stack {
  public readonly bucketUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for static website hosting (NO CloudFront - simpler, no verification needed)
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing fallback
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    this.bucketUrl = websiteBucket.bucketWebsiteUrl;

    // Deploy frontend files (if they exist)
    const frontendPath = path.join(__dirname, '../../frontend/build');
    try {
      new s3deploy.BucketDeployment(this, 'DeployFrontend', {
        sources: [s3deploy.Source.asset(frontendPath)],
        destinationBucket: websiteBucket,
      });
    } catch (error) {
      // Frontend build doesn't exist yet - that's okay
      console.log('Frontend build not found - deploy manually later');
    }

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: websiteBucket.bucketWebsiteUrl,
      description: 'S3 Static Website URL (HTTP)',
      exportName: 'CIAlert-WebsiteURL',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 Bucket Name',
      exportName: 'CIAlert-BucketName',
    });
  }
}
