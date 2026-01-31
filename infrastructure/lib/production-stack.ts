import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ProductionStackProps extends cdk.StackProps {
  readonly apiGateway: apigateway.RestApi;
  readonly lambdaFunctions: { [key: string]: lambda.Function };
  readonly adminEmail: string;
}

export class ProductionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProductionStackProps) {
    super(scope, id, props);

    // SNS Topic for production alerts
    const alertTopic = new sns.Topic(this, 'ProductionAlerts', {
      topicName: 'ci-alert-production-alerts',
      displayName: 'CI Alert Production Monitoring',
    });

    alertTopic.addSubscription(
      new subscriptions.EmailSubscription(props.adminEmail)
    );

    // WAF Web ACL for API Gateway protection
    const webAcl = new wafv2.CfnWebACL(this, 'APIGatewayWAF', {
      name: 'ci-alert-api-protection',
      description: 'WAF protection for CI Alert API Gateway',
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      
      rules: [
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP'
            }
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule'
          }
        },
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet'
            }
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric'
          }
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet'
            }
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsMetric'
          }
        }
      ],
      
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'CIAlertWAF'
      }
    });

    // Associate WAF with API Gateway
    new wafv2.CfnWebACLAssociation(this, 'WAFAssociation', {
      resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${props.apiGateway.restApiId}/stages/prod`,
      webAclArn: webAcl.attrArn
    });

    // Production CloudWatch Alarms
    
    // API Gateway 5XX Errors
    const api5xxAlarm = new cloudwatch.Alarm(this, 'API5XXErrorAlarm', {
      alarmName: 'CIAlert-API-5XX-Errors',
      alarmDescription: 'High 5XX error rate in API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: props.apiGateway.restApiName
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      }),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    api5xxAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // API Gateway Latency
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'APILatencyAlarm', {
      alarmName: 'CIAlert-API-High-Latency',
      alarmDescription: 'High latency in API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: {
          ApiName: props.apiGateway.restApiName
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average'
      }),
      threshold: 3000, // 3 seconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    apiLatencyAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // Lambda Function Alarms
    Object.entries(props.lambdaFunctions).forEach(([name, func]) => {
      // Error Rate Alarm
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ProductionErrorAlarm`, {
        alarmName: `CIAlert-Production-${name}-Errors`,
        alarmDescription: `Production error rate for ${name} function`,
        metric: func.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum'
        }),
        threshold: 3,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
      errorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

      // Duration Alarm
      const durationAlarm = new cloudwatch.Alarm(this, `${name}ProductionDurationAlarm`, {
        alarmName: `CIAlert-Production-${name}-Duration`,
        alarmDescription: `Production high duration for ${name} function`,
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: 'Average'
        }),
        threshold: 60000, // 60 seconds
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
      durationAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
    });

    // Cost Alarm
    const costAlarm = new cloudwatch.Alarm(this, 'ProductionCostAlarm', {
      alarmName: 'CIAlert-Production-High-Cost',
      alarmDescription: 'Monthly cost exceeds production threshold',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Billing',
        metricName: 'EstimatedCharges',
        dimensionsMap: {
          Currency: 'USD'
        },
        period: cdk.Duration.hours(6),
        statistic: 'Maximum'
      }),
      threshold: 500, // $500 per month
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    costAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // WAF Blocked Requests Alarm
    const wafBlockedAlarm = new cloudwatch.Alarm(this, 'WAFBlockedRequestsAlarm', {
      alarmName: 'CIAlert-WAF-Blocked-Requests',
      alarmDescription: 'High number of blocked requests by WAF',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/WAFV2',
        metricName: 'BlockedRequests',
        dimensionsMap: {
          WebACL: webAcl.name!,
          Region: this.region,
          Rule: 'ALL'
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      }),
      threshold: 100,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    wafBlockedAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

    // Outputs
    new cdk.CfnOutput(this, 'WAFWebACLArn', {
      value: webAcl.attrArn,
      description: 'WAF Web ACL ARN',
      exportName: 'CIAlert-Production-WAFArn'
    });

    new cdk.CfnOutput(this, 'ProductionAlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'Production Alert Topic ARN',
      exportName: 'CIAlert-Production-AlertTopicArn'
    });

    new cdk.CfnOutput(this, 'ProductionDashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#alarmsV2:`,
      description: 'Production CloudWatch Alarms URL',
      exportName: 'CIAlert-Production-DashboardUrl'
    });
  }
}