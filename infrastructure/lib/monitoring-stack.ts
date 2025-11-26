import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  apiName: string;
  alertEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const apiName = props.apiName;
    const alertEmail = props.alertEmail || 'alerts@example.com';

    // SNS Topic for Alerts
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      displayName: 'CI Alert System Notifications',
    });

    alertTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: 'CI-Alert-System',
    });

    // API Gateway Metrics
    const apiRequests = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: { ApiName: apiName },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api4xxErrors = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: { ApiName: apiName },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api5xxErrors = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: { ApiName: apiName },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiLatency = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: { ApiName: apiName },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Lambda Metrics
    const lambdaErrors = new cloudwatch.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Errors',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const lambdaDuration = new cloudwatch.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'Duration',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // DynamoDB Metrics
    const dynamoReadCapacity = new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'ConsumedReadCapacityUnits',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const dynamoWriteCapacity = new cloudwatch.Metric({
      namespace: 'AWS/DynamoDB',
      metricName: 'ConsumedWriteCapacityUnits',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Add widgets to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [apiRequests],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [api4xxErrors, api5xxErrors],
        width: 12,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [apiLatency],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Performance',
        left: [lambdaErrors],
        right: [lambdaDuration],
        width: 12,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Capacity',
        left: [dynamoReadCapacity, dynamoWriteCapacity],
        width: 24,
      })
    );

    // Alarms
    const highErrorAlarm = new cloudwatch.Alarm(this, 'HighErrorRate', {
      metric: api5xxErrors,
      threshold: 10,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when API 5xx errors exceed threshold',
    });
    highErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatency', {
      metric: apiLatency,
      threshold: 3000,
      evaluationPeriods: 3,
      alarmDescription: 'Alert when API latency exceeds 3 seconds',
    });
    highLatencyAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrors', {
      metric: lambdaErrors,
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when Lambda errors exceed threshold',
    });
    lambdaErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // Outputs
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS Alert Topic ARN',
    });

    new cdk.CfnOutput(this, 'MonitoredApiName', {
      value: apiName,
      description: 'API being monitored',
    });
  }
}
