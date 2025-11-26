import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class CICDStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Artifact Bucket
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CodeCommit Repository
    const repository = new codecommit.Repository(this, 'Repository', {
      repositoryName: 'ci-alert-system',
      description: 'CI Alert System Source Code',
    });

    // CodeBuild Project for Infrastructure
    const infraBuildProject = new codebuild.PipelineProject(this, 'InfraBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'npm install -g aws-cdk',
              'cd infrastructure',
              'npm install',
            ],
          },
          build: {
            commands: [
              'npm run build',
              'cdk synth',
            ],
          },
        },
        artifacts: {
          'base-directory': 'infrastructure/cdk.out',
          files: ['**/*'],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
    });

    // CodeBuild Project for Lambda
    const lambdaBuildProject = new codebuild.PipelineProject(this, 'LambdaBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'pip install -r lambdas/requirements.txt -t lambdas/',
            ],
          },
          build: {
            commands: [
              'cd lambdas',
              'zip -r lambda-package.zip .',
            ],
          },
        },
        artifacts: {
          files: ['lambdas/lambda-package.zip'],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
    });

    // CodeBuild Project for Frontend
    const frontendBuildProject = new codebuild.PipelineProject(this, 'FrontendBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
            ],
          },
          build: {
            commands: [
              'cd frontend',
              'docker build -t ci-alert-frontend .',
              'docker tag ci-alert-frontend:latest $ECR_REPO_URI:latest',
            ],
          },
          post_build: {
            commands: [
              'docker push $ECR_REPO_URI:latest',
            ],
          },
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
      environmentVariables: {
        AWS_ACCOUNT_ID: {
          value: this.account,
        },
        ECR_REPO_URI: {
          value: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/ci-alert-frontend`,
        },
      },
    });

    // Grant ECR permissions
    frontendBuildProject.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
      ],
      resources: ['*'],
    }));

    // Pipeline
    const sourceOutput = new codepipeline.Artifact();
    const infraBuildOutput = new codepipeline.Artifact('InfraBuildOutput');
    const lambdaBuildOutput = new codepipeline.Artifact('LambdaBuildOutput');

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'CI-Alert-Pipeline',
      artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeCommitSourceAction({
              actionName: 'CodeCommit',
              repository,
              output: sourceOutput,
              branch: 'main',
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'BuildInfrastructure',
              project: infraBuildProject,
              input: sourceOutput,
              outputs: [infraBuildOutput],
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'BuildLambdas',
              project: lambdaBuildProject,
              input: sourceOutput,
              outputs: [lambdaBuildOutput],
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'BuildFrontend',
              project: frontendBuildProject,
              input: sourceOutput,
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'DeployInfrastructure',
              stackName: 'CIAlertStack',
              templatePath: infraBuildOutput.atPath('CIAlertStack.template.json'),
              adminPermissions: true,
            }),
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'RepositoryCloneUrl', {
      value: repository.repositoryCloneUrlHttp,
      description: 'CodeCommit Repository Clone URL',
    });

    new cdk.CfnOutput(this, 'PipelineUrl', {
      value: `https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipeline.pipelineName}/view`,
      description: 'CodePipeline Console URL',
    });

    new cdk.CfnOutput(this, 'ArtifactBucketName', {
      value: artifactBucket.bucketName,
      description: 'Pipeline Artifact Bucket',
    });
  }
}
