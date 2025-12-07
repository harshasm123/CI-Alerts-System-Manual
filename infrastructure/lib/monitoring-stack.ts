import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  apiName?: string;
  alertEmail?: string;
  albName?: string;
  ecsClusterName?: string;
  ecsServiceName?: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MonitoringStackProps) {
    super(scope, id, props);

    const apiName = props?.apiName || 'CI Alert API';
    const alertEmail = props?.alertEmail || 'alerts@example.com';
    const albName = props?.albName || 'ci-alert-frontend-alb';
    const ecsClusterName = props?.ecsClusterName || 'ci-alert-frontend-cluster';
    const ecsServiceName = props?.ecsServiceName || 'FrontendService';

    // SNS Topic for Alerts
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      displayName: 'CI Alert System Production Alerts',
      topicName: 'ci-alert-production-alerts',
    });

    alertTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));

    // Log Groups for centralized logging
    const applicationLogGroup = new logs.LogGroup(this, 'ApplicationLogGroup', {
      logGroupName: '/ci-alert/application',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const performanceLogGroup = new logs.LogGroup(this, 'PerformanceLogGroup', {
      logGroupName: '/ci-alert/performance',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Production CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'ProductionDashboard', {
      dashboardName: 'CI-Alert-Production-System',
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // ALB Metrics (Production Frontend)
    const albRequests = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'RequestCount',
      dimensionsMap: { LoadBalancer: `app/${albName}/*` },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const albLatency = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'TargetResponseTime',
      dimensionsMap: { LoadBalancer: `app/${albName}/*` },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const albErrors = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_ELB_5XX_Count',
      dimensionsMap: { LoadBalancer: `app/${albName}/*` },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const albTargetHealth = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HealthyHostCount',
      dimensionsMap: { LoadBalancer: `app/${albName}/*` },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    });

    // ECS Metrics (Production Container Platform)
    const ecsCpuUtilization = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'CPUUtilization',
      dimensionsMap: { 
        ServiceName: ecsServiceName,
        ClusterName: ecsClusterName 
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const ecsMemoryUtilization = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'MemoryUtilization',
      dimensionsMap: { 
        ServiceName: ecsServiceName,
        ClusterName: ecsClusterName 
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const ecsRunningTasks = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'RunningTaskCount',
      dimensionsMap: { 
        ServiceName: ecsServiceName,
        ClusterName: ecsClusterName 
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    });

    // API Gateway Metrics (Backend)
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

    // Production Dashboard Layout
    
    // Row 1: Frontend Infrastructure (ALB + ECS)
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB Request Volume',
        left: [albRequests],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB Response Time',
        left: [albLatency],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ALB Errors & Health',
        left: [albErrors],
        right: [albTargetHealth],
        width: 8,
        height: 6,
      })
    );

    // Row 2: Container Platform (ECS)
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS CPU Utilization',
        left: [ecsCpuUtilization],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Memory Utilization',
        left: [ecsMemoryUtilization],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Running Tasks',
        left: [ecsRunningTasks],
        width: 8,
        height: 6,
      })
    );

    // Row 3: Backend Services (API Gateway + Lambda)
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [apiRequests],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [api4xxErrors, api5xxErrors],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [apiLatency],
        width: 8,
        height: 6,
      })
    );

    // Row 4: Lambda & Database Performance
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Performance',
        left: [lambdaErrors],
        right: [lambdaDuration],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Capacity',
        left: [dynamoReadCapacity, dynamoWriteCapacity],
        width: 12,
        height: 6,
      })
    );

    // Production Alarms (Critical System Health)
    
    // ALB Health Alarms
    const albHighErrorAlarm = new cloudwatch.Alarm(this, 'ALBHighErrorRate', {
      metric: albErrors,
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ALB 5xx errors exceed threshold - Frontend issues detected',
      alarmName: 'CI-Alert-ALB-HighErrors',
    });
    albHighErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    const albHighLatencyAlarm = new cloudwatch.Alarm(this, 'ALBHighLatency', {
      metric: albLatency,
      threshold: 2.0, // 2 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ALB response time exceeds 2 seconds - Performance degradation',
      alarmName: 'CI-Alert-ALB-HighLatency',
    });
    albHighLatencyAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    const albUnhealthyTargetsAlarm = new cloudwatch.Alarm(this, 'ALBUnhealthyTargets', {
      metric: albTargetHealth,
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'ALB has no healthy targets - Service unavailable',
      alarmName: 'CI-Alert-ALB-UnhealthyTargets',
    });
    albUnhealthyTargetsAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // ECS Health Alarms
    const ecsHighCpuAlarm = new cloudwatch.Alarm(this, 'ECSHighCPU', {
      metric: ecsCpuUtilization,
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ECS CPU utilization exceeds 80% - Auto-scaling may be needed',
      alarmName: 'CI-Alert-ECS-HighCPU',
    });
    ecsHighCpuAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    const ecsHighMemoryAlarm = new cloudwatch.Alarm(this, 'ECSHighMemory', {
      metric: ecsMemoryUtilization,
      threshold: 85,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ECS memory utilization exceeds 85% - Memory pressure detected',
      alarmName: 'CI-Alert-ECS-HighMemory',
    });
    ecsHighMemoryAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    const ecsNoRunningTasksAlarm = new cloudwatch.Alarm(this, 'ECSNoRunningTasks', {
      metric: ecsRunningTasks,
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'No ECS tasks running - Service completely down',
      alarmName: 'CI-Alert-ECS-NoTasks',
    });
    ecsNoRunningTasksAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // API Gateway Alarms (Backend)
    const apiHighErrorAlarm = new cloudwatch.Alarm(this, 'APIHighErrorRate', {
      metric: api5xxErrors,
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API Gateway 5xx errors exceed threshold - Backend issues',
      alarmName: 'CI-Alert-API-HighErrors',
    });
    apiHighErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    const apiHighLatencyAlarm = new cloudwatch.Alarm(this, 'APIHighLatency', {
      metric: apiLatency,
      threshold: 3000,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API Gateway latency exceeds 3 seconds - Backend performance issues',
      alarmName: 'CI-Alert-API-HighLatency',
    });
    apiHighLatencyAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // Lambda Alarms
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrors', {
      metric: lambdaErrors,
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda errors exceed threshold - Function failures detected',
      alarmName: 'CI-Alert-Lambda-Errors',
    });
    lambdaErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // Outputs
    new cdk.CfnOutput(this, 'ProductionDashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'Production CloudWatch Dashboard URL',
      exportName: 'CIAlert-Dashboard-URL',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'Production Alert SNS Topic ARN',
      exportName: 'CIAlert-Alert-Topic-ARN',
    });

    new cdk.CfnOutput(this, 'ApplicationLogGroup', {
      value: applicationLogGroup.logGroupName,
      description: 'Application Log Group Name',
      exportName: 'CIAlert-App-LogGroup',
    });

    new cdk.CfnOutput(this, 'PerformanceLogGroup', {
      value: performanceLogGroup.logGroupName,
      description: 'Performance Log Group Name',
      exportName: 'CIAlert-Perf-LogGroup',
    });
  }
}
