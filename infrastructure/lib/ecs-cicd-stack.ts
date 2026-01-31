import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ECSCICDStackProps extends cdk.StackProps {
  readonly githubToken: string;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly apiUrl?: string;
  readonly userPoolId?: string;
  readonly userPoolClientId?: string;
}

export class ECSCICDStack extends cdk.Stack {
  public readonly albUrl: string;
  public readonly ecsService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ECSCICDStackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'CIAlertVPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ECR Repository
    const ecrRepo = new ecr.Repository(this, 'CIAlertECR', {
      repositoryName: 'ci-alert-frontend',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'CIAlertCluster', {
      vpc,
      containerInsights: true,
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'CIAlertALB', {
      vpc,
      internetFacing: true,
    });

    const listener = alb.addListener('Listener', {
      port: 80,
      open: true,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'CIAlertTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const container = taskDefinition.addContainer('CIAlertContainer', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      memoryLimitMiB: 512,
      environment: {
        REACT_APP_API_URL: props.apiUrl || '',
        REACT_APP_USER_POOL_ID: props.userPoolId || '',
        REACT_APP_USER_POOL_CLIENT_ID: props.userPoolClientId || '',
        REACT_APP_REGION: this.region,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ci-alert',
        logGroup: new logs.LogGroup(this, 'CIAlertLogGroup', {
          logGroupName: '/ecs/ci-alert',
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
    });

    container.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    // ECS Service
    this.ecsService = new ecs.FargateService(this, 'CIAlertService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      assignPublicIp: false,
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'CIAlertTargetGroup', {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        healthyHttpCodes: '200',
        path: '/',
        protocol: elbv2.Protocol.HTTP,
      },
    });

    listener.addTargetGroups('DefaultTargetGroup', {
      targetGroups: [targetGroup],
    });

    this.ecsService.attachToApplicationTargetGroup(targetGroup);

    // GitHub Token Secret
    const githubSecret = new secretsmanager.Secret(this, 'GitHubToken', {
      secretName: 'ci-alert-github-token',
      secretStringValue: cdk.SecretValue.unsafePlainText(props.githubToken),
    });

    // CodeBuild Project
    const buildProject = new codebuild.Project(this, 'CIAlertBuild', {
      source: codebuild.Source.gitHub({
        owner: props.githubOwner,
        repo: props.githubRepo,
        webhook: true,
        webhookFilters: [
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andBranchIs('main'),
        ],
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Building the Docker image...',
              'cd frontend',
              'docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .',
              'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $REPOSITORY_URI:$IMAGE_TAG',
              'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $REPOSITORY_URI:latest',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing the Docker image...',
              'docker push $REPOSITORY_URI:$IMAGE_TAG',
              'docker push $REPOSITORY_URI:latest',
              'echo Updating ECS service...',
              'aws ecs update-service --cluster $ECS_CLUSTER_NAME --service $ECS_SERVICE_NAME --force-new-deployment',
              'printf \'[{"name":"CIAlertContainer","imageUri":"%s"}]\' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['imagedefinitions.json'],
        },
      }),
      environmentVariables: {
        AWS_DEFAULT_REGION: {
          value: this.region,
        },
        AWS_ACCOUNT_ID: {
          value: this.account,
        },
        IMAGE_REPO_NAME: {
          value: ecrRepo.repositoryName,
        },
        ECS_CLUSTER_NAME: {
          value: cluster.clusterName,
        },
        ECS_SERVICE_NAME: {
          value: this.ecsService.serviceName,
        },
      },
    });

    // Grant permissions
    ecrRepo.grantPullPush(buildProject);
    this.ecsService.taskDefinition.grantRun(buildProject);
    
    buildProject.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ecs:UpdateService',
        'ecs:DescribeServices',
      ],
      resources: [this.ecsService.serviceArn],
    }));

    // CodePipeline
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    new codepipeline.Pipeline(this, 'CIAlertPipeline', {
      pipelineName: 'ci-alert-ecs-pipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: props.githubOwner,
              repo: props.githubRepo,
              oauthToken: githubSecret.secretValue,
              output: sourceOutput,
              branch: 'main',
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Build',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipeline_actions.EcsDeployAction({
              actionName: 'Deploy',
              service: this.ecsService,
              input: buildOutput,
            }),
          ],
        },
      ],
    });

    this.albUrl = `http://${alb.loadBalancerDnsName}`;

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerURL', {
      value: this.albUrl,
      description: 'Application Load Balancer URL',
    });

    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: ecrRepo.repositoryUri,
      description: 'ECR Repository URI',
    });

    new cdk.CfnOutput(this, 'ECSClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster Name',
    });

    new cdk.CfnOutput(this, 'ECSServiceName', {
      value: this.ecsService.serviceName,
      description: 'ECS Service Name',
    });
  }
}