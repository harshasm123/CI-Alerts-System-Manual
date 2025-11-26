import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface CicdStackProps extends cdk.StackProps {
  ecsService: ecs.FargateService;
  lambdaFunctions: { [key: string]: lambda.Function };
}

export class CicdStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    // S3 Bucket for pipeline artifacts
    const artifactsBucket = new s3.Bucket(this, 'PipelineArtifacts', {
      bucketName: `ci-alert-pipeline-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'delete-old-artifacts',
          enabled: true,
          expiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CodeCommit Repository
    const repository = new codecommit.Repository(this, 'CIAlertRepository', {
      repositoryName: 'ci-alert-system',
      description: 'CI Alert System source code',
    });

    // CodeBuild Service Role
    const codeBuildRole = new iam.Role(this, 'CodeBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'),
      ],
      inlinePolicies: {
        CodeBuildPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
              ],
              resources: [`${artifactsBucket.bucketArn}/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lambda:UpdateFunctionCode',
                'lambda:GetFunction',
              ],
              resources: Object.values(props.lambdaFunctions).map(func => func.functionArn),
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecs:UpdateService',
                'ecs:DescribeServices',
              ],
              resources: [props.ecsService.serviceArn],
            }),
          ],
        }),
      },
    });

    // CodeBuild Project for Frontend
    const frontendBuildProject = new codebuild.Project(this, 'FrontendBuildProject', {
      projectName: 'ci-alert-frontend-build',
      source: codebuild.Source.codeCommit({
        repository: repository,
        branchOrRef: 'main',
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
        computeType: codebuild.ComputeType.SMALL,
      },
      role: codeBuildRole,
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
              'echo Build started on `date`',
              'echo Building the Docker image...',
              'cd frontend',
              'docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .',
              'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing the Docker image...',
              'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG',
              'echo Updating ECS service...',
              'aws ecs update-service --cluster $ECS_CLUSTER_NAME --service $ECS_SERVICE_NAME --force-new-deployment',
            ],
          },
        },
      }),
      environmentVariables: {
        AWS_DEFAULT_REGION: {
          value: cdk.Aws.REGION,
        },
        AWS_ACCOUNT_ID: {
          value: cdk.Aws.ACCOUNT_ID,
        },
        IMAGE_REPO_NAME: {
          value: 'ci-alert-frontend',
        },
        IMAGE_TAG: {
          value: 'latest',
        },
        ECS_CLUSTER_NAME: {
          value: props.ecsService.cluster.clusterName,
        },
        ECS_SERVICE_NAME: {
          value: props.ecsService.serviceName,
        },
      },
    });

    // CodeBuild Project for Lambda Functions
    const lambdaBuildProject = new codebuild.Project(this, 'LambdaBuildProject', {
      projectName: 'ci-alert-lambda-build',
      source: codebuild.Source.codeCommit({
        repository: repository,
        branchOrRef: 'main',
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      role: codeBuildRole,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              python: '3.11',
            },
          },
          pre_build: {
            commands: [
              'echo Installing dependencies...',
              'cd lambdas',
              'pip install -r requirements.txt -t .',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Creating deployment packages...',
              'find . -name "*.py" -exec zip -r lambda-deployment.zip {} +',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Updating Lambda functions...',
              // Update each Lambda function
              ...Object.entries(props.lambdaFunctions).map(([name, func]) => 
                `aws lambda update-function-code --function-name ${func.functionName} --zip-file fileb://lambda-deployment.zip`
              ),
            ],
          },
        },
        artifacts: {
          files: [
            'lambda-deployment.zip',
          ],
        },
      }),
    });

    // CodeBuild Project for Infrastructure
    const infraBuildProject = new codebuild.Project(this, 'InfraBuildProject', {
      projectName: 'ci-alert-infra-build',
      source: codebuild.Source.codeCommit({
        repository: repository,
        branchOrRef: 'main',
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      role: codeBuildRole,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '18',
            },
            commands: [
              'npm install -g aws-cdk',
            ],
          },
          pre_build: {
            commands: [
              'echo Installing dependencies...',
              'cd infrastructure',
              'npm install',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Synthesizing CDK...',
              'npm run build',
              'cdk synth',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Deploying infrastructure...',
              'cdk deploy --all --require-approval never',
            ],
          },
        },
      }),
    });

    // Grant additional permissions to infrastructure build project
    infraBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['*'],
        resources: ['*'],
      })
    );

    // CodePipeline
    const sourceOutput = new codepipeline.Artifact();
    const frontendBuildOutput = new codepipeline.Artifact();
    const lambdaBuildOutput = new codepipeline.Artifact();

    const pipeline = new codepipeline.Pipeline(this, 'CIAlertPipeline', {
      pipelineName: 'ci-alert-pipeline',
      artifactBucket: artifactsBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipelineActions.CodeCommitSourceAction({
              actionName: 'CodeCommit',
              repository: repository,
              branch: 'main',
              output: sourceOutput,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipelineActions.CodeBuildAction({
              actionName: 'BuildFrontend',
              project: frontendBuildProject,
              input: sourceOutput,
              outputs: [frontendBuildOutput],
            }),
            new codepipelineActions.CodeBuildAction({
              actionName: 'BuildLambdas',
              project: lambdaBuildProject,
              input: sourceOutput,
              outputs: [lambdaBuildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipelineActions.CodeBuildAction({
              actionName: 'DeployInfrastructure',
              project: infraBuildProject,
              input: sourceOutput,
            }),
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'RepositoryCloneUrl', {
      value: repository.repositoryCloneUrlHttp,
      exportName: 'CIAlert-RepositoryCloneUrl',
    });

    new cdk.CfnOutput(this, 'PipelineName', {
      value: pipeline.pipelineName,
      exportName: 'CIAlert-PipelineName',
    });

    new cdk.CfnOutput(this, 'PipelineUrl', {
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipeline.pipelineName}/view`,
      exportName: 'CIAlert-PipelineUrl',
    });
  }
}