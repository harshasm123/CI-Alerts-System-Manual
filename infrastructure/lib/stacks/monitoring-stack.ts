import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  lambdaFunctions: { [key: string]: lambda.Function };
  ecsService: ecs.FargateService;
  apiGateway: apigateway.RestApi;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for alerts
    const alertTopic = new sns.Topic(this, 'CIAlertTopic', {
      topicName: 'ci-alert-monitoring',
      displayName: 'CI Alert System Monitoring',
    });

    // Add email subscription (replace with actual email)
    alertTopic.addSubscription(
      new subscriptions.EmailSubscription('admin@example.com')
    );

    // Lambda Function Alarms
    Object.entries(props.lambdaFunctions).forEach(([name, func]) => {
      // Error Rate Alarm
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        alarmName: `CIAlert-${name}-Errors`,
        alarmDescription: `High error rate for ${name} function`,
        metric: func.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

      // Duration Alarm
      const durationAlarm = new cloudwatch.Alarm(this, `${name}DurationAlarm`, {
        alarmName: `CIAlert-${name}-Duration`,
        alarmDescription: `High duration for ${name} function`,
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: 'Average',
        }),
        threshold: 30000, // 30 seconds
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      durationAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

      // Throttle Alarm
      const throttleAlarm = new cloudwatch.Alarm(this, `${name}ThrottleAlarm`, {
        alarmName: `CIAlert-${name}-Throttles`,
        alarmDescription: `Throttling detected for ${name} function`,
        metric: func.metricThrottles({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      throttleAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));
    });

    // ECS Service Alarms
    const ecsServiceName = props.ecsService.serviceName;
    const ecsClusterName = props.ecsService.cluster.clusterName;

    const ecsCpuAlarm = new cloudwatch.Alarm(this, 'ECSCpuAlarm', {
      alarmName: 'CIAlert-ECS-HighCPU',
      alarmDescription: 'High CPU utilization for ECS service',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ServiceName: ecsServiceName,
          ClusterName: ecsClusterName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    ecsCpuAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

    const ecsMemoryAlarm = new cloudwatch.Alarm(this, 'ECSMemoryAlarm', {
      alarmName: 'CIAlert-ECS-HighMemory',
      alarmDescription: 'High memory utilization for ECS service',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: {
          ServiceName: ecsServiceName,
          ClusterName: ecsClusterName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 85,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    ecsMemoryAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

    // API Gateway Alarms
    const apiErrorAlarm = new cloudwatch.Alarm(this, 'APIErrorAlarm', {
      alarmName: 'CIAlert-API-Errors',
      alarmDescription: 'High error rate for API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: props.apiGateway.restApiName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiErrorAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'APILatencyAlarm', {
      alarmName: 'CIAlert-API-Latency',
      alarmDescription: 'High latency for API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: props.apiGateway.restApiName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiLatencyAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

    // Cost Alarm
    const costAlarm = new cloudwatch.Alarm(this, 'CostAlarm', {
      alarmName: 'CIAlert-HighCost',
      alarmDescription: 'Monthly cost exceeds threshold',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Billing',
        metricName: 'EstimatedCharges',
        dimensionsMap: {
          Currency: 'USD',
        },
        period: cdk.Duration.hours(6),
        statistic: 'Maximum',
      }),
      threshold: 1000, // $1000 per month
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    costAlarm.addAlarmAction(new cloudwatch.SnsAction(alertTopic));

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'CIAlertDashboard', {
      dashboardName: 'CI-Alert-System',
    });

    // Lambda metrics widgets
    const lambdaWidgets = Object.entries(props.lambdaFunctions).map(([name, func]) => [
      new cloudwatch.GraphWidget({
        title: `${name} - Invocations & Errors`,
        left: [func.metricInvocations()],
        right: [func.metricErrors()],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: `${name} - Duration`,
        left: [func.metricDuration()],
        width: 12,
        height: 6,
      }),
    ]).flat();

    // ECS metrics widget
    const ecsWidget = new cloudwatch.GraphWidget({
      title: 'ECS Service - CPU & Memory',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            ServiceName: ecsServiceName,
            ClusterName: ecsClusterName,
          },
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'MemoryUtilization',
          dimensionsMap: {
            ServiceName: ecsServiceName,
            ClusterName: ecsClusterName,
          },
        }),
      ],
      width: 24,
      height: 6,
    });

    // API Gateway metrics widget
    const apiWidget = new cloudwatch.GraphWidget({
      title: 'API Gateway - Requests & Latency',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Count',
          dimensionsMap: {
            ApiName: props.apiGateway.restApiName,
          },
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          dimensionsMap: {
            ApiName: props.apiGateway.restApiName,
          },
        }),
      ],
      width: 24,
      height: 6,
    });

    // Add widgets to dashboard
    dashboard.addWidgets(ecsWidget, apiWidget, ...lambdaWidgets);

    // Custom metrics for business logic
    const customMetricNamespace = 'CIAlert/Business';

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#dashboards:name=${dashboard.dashboardName}`,
      exportName: 'CIAlert-DashboardUrl',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      exportName: 'CIAlert-AlertTopicArn',
    });
  }
}