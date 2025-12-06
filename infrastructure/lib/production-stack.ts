import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class ProductionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Production monitoring and alerting
    const alertTopic = new sns.Topic(this, 'ProductionAlerts', {
      displayName: 'CI Alert Production Notifications',
    });

    // Add email subscription for alerts
    alertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(
        process.env.ALERT_EMAIL || 'admin@example.com'
      )
    );

    // Model configuration parameter
    const modelConfig = new ssm.StringParameter(this, 'ModelConfig', {
      parameterName: '/ci-alert/model-config',
      stringValue: JSON.stringify({
        primary_model: {
          id: 'anthropic.claude-3-5-haiku-20241022-v1:0',
          version: 'v1.0',
          traffic_percentage: 90,
          max_tokens: 1000,
          temperature: 0.7
        },
        canary_model: {
          id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          version: 'v2.0',
          traffic_percentage: 10,
          max_tokens: 1000,
          temperature: 0.7
        }
      }),
      description: 'Model routing configuration for CI Alert system'
    });

    // Enhanced Lambda role with production permissions
    const productionLambdaRole = new iam.Role(this, 'ProductionLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    });

    // Add production permissions
    productionLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock-agent-runtime:InvokeAgent',
        'cloudwatch:PutMetricData',
        'ssm:GetParameter',
        'ssm:PutParameter',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: ['*'],
    }));

    // Model router Lambda with enhanced monitoring
    const modelRouter = new lambda.Function(this, 'ModelRouter', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'model_manager.ModelManager',
      code: lambda.Code.fromAsset('../lambdas/ml-pipeline'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      role: productionLambdaRole,
      environment: {
        MODEL_CONFIG_PARAM: modelConfig.parameterName,
        POWERTOOLS_SERVICE_NAME: 'ci-alert-model-router',
        LOG_LEVEL: 'INFO'
      },
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    });

    // Production CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'ProductionDashboard', {
      dashboardName: 'CIAlert-Production-Metrics',
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'Model Performance',
            width: 12,
            height: 6,
            left: [
              new cloudwatch.Metric({
                namespace: 'CIAlert/ML',
                metricName: 'ModelLatency',
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
              }),
            ],
            right: [
              new cloudwatch.Metric({
                namespace: 'CIAlert/ML',
                metricName: 'ModelInvocations',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
              }),
            ],
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Error Rates',
            width: 12,
            height: 6,
            left: [
              new cloudwatch.Metric({
                namespace: 'CIAlert/ML',
                metricName: 'ModelInvocations',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
                dimensionsMap: { Status: 'error' },
              }),
            ],
          }),
        ],
        [
          new cloudwatch.SingleValueWidget({
            title: 'System Health',
            width: 6,
            height: 6,
            metrics: [
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                statistic: 'Average',
                dimensionsMap: { FunctionName: modelRouter.functionName },
              }),
            ],
          }),
          new cloudwatch.SingleValueWidget({
            title: 'Error Rate',
            width: 6,
            height: 6,
            metrics: [
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Errors',
                statistic: 'Sum',
                dimensionsMap: { FunctionName: modelRouter.functionName },
              }),
            ],
          }),
        ],
      ],
    });

    // Production Alarms
    const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRate', {
      metric: new cloudwatch.Metric({
        namespace: 'CIAlert/ML',
        metricName: 'ModelInvocations',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: { Status: 'error' },
      }),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'High error rate detected in model invocations',
    });

    const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatency', {
      metric: new cloudwatch.Metric({
        namespace: 'CIAlert/ML',
        metricName: 'ModelLatency',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 30, // 30 seconds
      evaluationPeriods: 3,
      alarmDescription: 'High latency detected in model responses',
    });

    // Connect alarms to SNS topic
    highErrorRateAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(alertTopic)
    );
    highLatencyAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(alertTopic)
    );

    // WAF for API protection
    const webAcl = new wafv2.CfnWebACL(this, 'ProductionWebACL', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      rules: [
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
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
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'ProductionWebACL',
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'Production Dashboard URL',
    });

    new cdk.CfnOutput(this, 'ModelConfigParameter', {
      value: modelConfig.parameterName,
      description: 'Model Configuration Parameter Store Path',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'Production Alert Topic ARN',
    });
  }
}