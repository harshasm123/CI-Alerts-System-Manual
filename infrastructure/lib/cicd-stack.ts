import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface CICDStackProps extends cdk.StackProps {
  readonly repositoryUrl: string;
  readonly githubToken: string;
}

export class CICDStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CICDStackProps) {
    super(scope, id, props);

    // GitHub access token from Secrets Manager
    const githubToken = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubToken', 'github-token');

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    // IAM role for CodeBuild
    const buildRole = new iam.Role(this, 'BuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
      ],
    });

    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '18',
              python: '3.11'
            },
            commands: [
              'npm install -g aws-cdk',
              'pip install --upgrade pip'
            ],
          },
          pre_build: {
            commands: [
              'cd infrastructure',
              'npm ci',
              'cd ../frontend',
              'npm ci',
              'cd ../lambdas',
              'pip install -r ingestion/requirements.txt -t .',
              'cd ..',
            ],
          },
          build: {
            commands: [
              'cd infrastructure',
              'npm run test || true',
              'npx cdk synth',
              'cd ../lambdas',
              'zip -r lambda-deployment.zip . -x "*.git*" "*.pyc" "__pycache__/*"',
              'cd ..',
            ],
          },
        },
        artifacts: {
          files: ['**/*'],
        },
      }),
    });

    const deployProject = new codebuild.PipelineProject(this, 'DeployProject', {
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
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
          build: {
            commands: [
              'cd infrastructure',
              'npx cdk deploy CIAlertStack --require-approval never',
              'npx cdk deploy CIAlert-KnowledgeBase --require-approval never',
              'npx cdk deploy CIAlert-BedrockAgent --require-approval never',
              'npx cdk deploy CIAlert-Amplify --require-approval never',
              'npx cdk deploy CIAlert-Production --require-approval never',
              'npx cdk deploy CIAlert-Monitoring --require-approval never',
            ],
          },
        },
      }),
    });
    new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'ci-alert-production-pipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: 'harshasm123',
              repo: 'CI-Alerts-System-Manual',
              oauthToken: githubToken.secretValue,
              output: sourceOutput,
              branch: 'main'
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
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy',
              project: deployProject,
              input: buildOutput,
            }),
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'PipelineName', {
      value: 'ci-alert-production-pipeline',
      description: 'CI/CD Pipeline Name',
      exportName: 'CIAlert-CICD-PipelineName'
    });

    new cdk.CfnOutput(this, 'PipelineUrl', {
      value: `https://${this.region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/ci-alert-production-pipeline/view`,
      description: 'CI/CD Pipeline URL',
      exportName: 'CIAlert-CICD-PipelineUrl'
    });
  }
}