import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  readonly lambdaFunctions: { [key: string]: lambda.Function };
  readonly apiGateway: apigateway.RestApi;
  readonly dynamoTables: { [key: string]: dynamodb.Table };
  readonly adminEmail: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for monitoring alerts
    this.alertTopic = new sns.Topic(this, 'MonitoringAlerts', {
      topicName: 'ci-alert-monitoring',
      displayName: 'CI Alert System Monitoring',
    });

    this.alertTopic.addSubscription(
      new subscriptions.EmailSubscription(props.adminEmail)
    );

    // Lambda Function Monitoring
    const lambdaWidgets: cloudwatch.IWidget[] = [];
    
    Object.entries(props.lambdaFunctions).forEach(([name, func]) => {
      // Error Rate Alarm
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        alarmName: `CIAlert-${name}-Errors`,
        alarmDescription: `Error rate alarm for ${name} function`,
        metric: func.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

      // Duration Alarm
      const durationAlarm = new cloudwatch.Alarm(this, `${name}DurationAlarm`, {
        alarmName: `CIAlert-${name}-Duration`,
        alarmDescription: `Duration alarm for ${name} function`,
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: 'Average',
        }),
        threshold: 30000, // 30 seconds
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      durationAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

      // Throttle Alarm
      const throttleAlarm = new cloudwatch.Alarm(this, `${name}ThrottleAlarm`, {
        alarmName: `CIAlert-${name}-Throttles`,
        alarmDescription: `Throttle alarm for ${name} function`,
        metric: func.metricThrottles({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      throttleAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

      // Lambda metrics widget
      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${name} - Invocations & Errors`,
          left: [func.metricInvocations()],
          right: [func.metricErrors()],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: `${name} - Duration & Throttles`,
          left: [func.metricDuration()],
          right: [func.metricThrottles()],
          width: 12,
          height: 6,
        })
      );
    });

    // API Gateway Monitoring
    const api4xxAlarm = new cloudwatch.Alarm(this, 'API4XXErrorAlarm', {
      alarmName: 'CIAlert-API-4XX-Errors',
      alarmDescription: 'High 4XX error rate for API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: props.apiGateway.restApiName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 20,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    api4xxAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

    const api5xxAlarm = new cloudwatch.Alarm(this, 'API5XXErrorAlarm', {
      alarmName: 'CIAlert-API-5XX-Errors',
      alarmDescription: 'High 5XX error rate for API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
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
    api5xxAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

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
    apiLatencyAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

    // DynamoDB Monitoring
    const dynamoWidgets: cloudwatch.IWidget[] = [];
    
    Object.entries(props.dynamoTables).forEach(([name, table]) => {
      // Read/Write throttle alarms
      const readThrottleAlarm = new cloudwatch.Alarm(this, `${name}ReadThrottleAlarm`, {
        alarmName: `CIAlert-${name}-ReadThrottles`,
        alarmDescription: `Read throttles for ${name} table`,
        metric: table.metricThrottledRequestsForOperations({
          operations: [dynamodb.Operation.GET_ITEM, dynamodb.Operation.QUERY, dynamodb.Operation.SCAN],
          period: cdk.Duration.minutes(5),
          statistic: 'Sum'
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
      readThrottleAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

      const writeThrottleAlarm = new cloudwatch.Alarm(this, `${name}WriteThrottleAlarm`, {
        alarmName: `CIAlert-${name}-WriteThrottles`,
        alarmDescription: `Write throttles for ${name} table`,
        metric: table.metricThrottledRequestsForOperations({
          operations: [dynamodb.Operation.PUT_ITEM, dynamodb.Operation.UPDATE_ITEM, dynamodb.Operation.DELETE_ITEM],
          period: cdk.Duration.minutes(5),
          statistic: 'Sum'
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
      writeThrottleAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

      // DynamoDB metrics widget
      dynamoWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${name} - Read/Write Operations`,
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/DynamoDB',
              metricName: 'SuccessfulRequestLatency',
              dimensionsMap: {
                TableName: table.tableName,
                Operation: 'GetItem'
              }
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/DynamoDB',
              metricName: 'SuccessfulRequestLatency',
              dimensionsMap: {
                TableName: table.tableName,
                Operation: 'Query'
              }
            })
          ],
          right: [
            new cloudwatch.Metric({
              namespace: 'AWS/DynamoDB',
              metricName: 'SuccessfulRequestLatency',
              dimensionsMap: {
                TableName: table.tableName,
                Operation: 'PutItem'
              }
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/DynamoDB',
              metricName: 'SuccessfulRequestLatency',
              dimensionsMap: {
                TableName: table.tableName,
                Operation: 'UpdateItem'
              }
            })
          ],
          width: 12,
          height: 6,
        })
      );
    });

    // Cost Monitoring
    const costAlarm = new cloudwatch.Alarm(this, 'CostAlarm', {
      alarmName: 'CIAlert-High-Cost',
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
      threshold: 200, // $200 per month
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    costAlarm.addAlarmAction(new actions.SnsAction(this.alertTopic));

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

    const errorWidget = new cloudwatch.GraphWidget({
      title: 'API Gateway - Errors',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          dimensionsMap: {
            ApiName: props.apiGateway.restApiName,
          },
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: {
            ApiName: props.apiGateway.restApiName,
          },
        }),
      ],
      width: 24,
      height: 6,
    });

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'CIAlertDashboard', {
      dashboardName: 'CI-Alert-System-Monitoring',
    });

    // Add widgets to dashboard
    this.dashboard.addWidgets(
      apiWidget,
      errorWidget,
      ...lambdaWidgets,
      ...dynamoWidgets
    );

    // Custom business metrics
    const businessMetricsWidget = new cloudwatch.GraphWidget({
      title: 'Business Metrics',
      left: [
        new cloudwatch.Metric({
          namespace: 'CIAlert/Business',
          metricName: 'InsightsGenerated',
          period: cdk.Duration.hours(1),
          statistic: 'Sum'
        }),
        new cloudwatch.Metric({
          namespace: 'CIAlert/Business',
          metricName: 'DocumentsProcessed',
          period: cdk.Duration.hours(1),
          statistic: 'Sum'
        })
      ],
      width: 24,
      height: 6
    });

    this.dashboard.addWidgets(businessMetricsWidget);

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: 'CIAlert-Monitoring-DashboardUrl'
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'Monitoring Alert Topic ARN',
      exportName: 'CIAlert-Monitoring-AlertTopicArn'
    });
  }
}