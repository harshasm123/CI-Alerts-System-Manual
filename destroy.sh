#!/bin/bash

# CI Alert System - Complete Infrastructure Cleanup Script
# WARNING: This will permanently delete ALL resources and data

set -e

echo "🚨 CI Alert System - Complete Cleanup"
echo "This will permanently delete ALL AWS resources and data"
echo "Press Ctrl+C to cancel, or wait 10 seconds to continue..."
sleep 10

# Set AWS region
export AWS_DEFAULT_REGION=${AWS_REGION:-us-east-1}

echo "🗑️  Starting cleanup process..."

# 1. Empty and delete S3 buckets
echo "📦 Cleaning up S3 buckets..."
aws s3 ls | grep ci-alert | awk '{print $3}' | while read bucket; do
    echo "Emptying bucket: $bucket"
    aws s3 rm s3://$bucket --recursive --quiet || true
    aws s3 rb s3://$bucket --force || true
done

# 2. Delete ECR repositories
echo "🐳 Cleaning up ECR repositories..."
aws ecr describe-repositories --query 'repositories[?contains(repositoryName, `ci-alert`)].repositoryName' --output text | tr '\t' '\n' | while read repo; do
    echo "Deleting ECR repository: $repo"
    aws ecr delete-repository --repository-name $repo --force || true
done

# 3. Stop and delete ECS services and tasks
echo "⚙️  Cleaning up ECS resources..."
aws ecs list-clusters --query 'clusterArns[?contains(@, `ci-alert`)]' --output text | while read cluster; do
    cluster_name=$(basename $cluster)
    echo "Cleaning cluster: $cluster_name"
    
    # Stop all services
    aws ecs list-services --cluster $cluster_name --query 'serviceArns' --output text | tr '\t' '\n' | while read service; do
        service_name=$(basename $service)
        aws ecs update-service --cluster $cluster_name --service $service_name --desired-count 0 || true
        aws ecs delete-service --cluster $cluster_name --service $service_name --force || true
    done
    
    # Stop all tasks
    aws ecs list-tasks --cluster $cluster_name --query 'taskArns' --output text | tr '\t' '\n' | while read task; do
        aws ecs stop-task --cluster $cluster_name --task $task || true
    done
    
    # Delete cluster
    aws ecs delete-cluster --cluster $cluster_name || true
done

# 4. Delete Lambda functions
echo "⚡ Cleaning up Lambda functions..."
aws lambda list-functions --query 'Functions[?contains(FunctionName, `ci-alert`)].FunctionName' --output text | tr '\t' '\n' | while read func; do
    echo "Deleting Lambda function: $func"
    aws lambda delete-function --function-name $func || true
done

# 5. Delete API Gateway APIs
echo "🌐 Cleaning up API Gateway..."
aws apigateway get-rest-apis --query 'items[?contains(name, `ci-alert`)].id' --output text | tr '\t' '\n' | while read api; do
    echo "Deleting API Gateway: $api"
    aws apigateway delete-rest-api --rest-api-id $api || true
done

# 6. Delete CloudFront distributions
echo "☁️  Cleaning up CloudFront distributions..."
aws cloudfront list-distributions --query 'DistributionList.Items[?contains(Comment, `ci-alert`)].Id' --output text | tr '\t' '\n' | while read dist; do
    echo "Disabling CloudFront distribution: $dist"
    # Get current config
    aws cloudfront get-distribution-config --id $dist --query 'DistributionConfig' > /tmp/dist-config.json
    # Disable distribution
    jq '.Enabled = false' /tmp/dist-config.json > /tmp/dist-config-disabled.json
    etag=$(aws cloudfront get-distribution-config --id $dist --query 'ETag' --output text)
    aws cloudfront update-distribution --id $dist --distribution-config file:///tmp/dist-config-disabled.json --if-match $etag || true
done

# 7. Delete DynamoDB tables
echo "🗄️  Cleaning up DynamoDB tables..."
aws dynamodb list-tables --query 'TableNames[?contains(@, `ci-alert`) || contains(@, `Insights`) || contains(@, `Watchlist`) || contains(@, `UserSettings`)]' --output text | tr '\t' '\n' | while read table; do
    echo "Deleting DynamoDB table: $table"
    aws dynamodb delete-table --table-name $table || true
done

# 8. Delete SQS queues
echo "📬 Cleaning up SQS queues..."
aws sqs list-queues --query 'QueueUrls[?contains(@, `ci-alert`)]' --output text | tr '\t' '\n' | while read queue; do
    echo "Deleting SQS queue: $queue"
    aws sqs delete-queue --queue-url $queue || true
done

# 9. Delete EventBridge rules
echo "⏰ Cleaning up EventBridge rules..."
aws events list-rules --query 'Rules[?contains(Name, `ci-alert`)].Name' --output text | tr '\t' '\n' | while read rule; do
    echo "Deleting EventBridge rule: $rule"
    # Remove targets first
    aws events list-targets-by-rule --rule $rule --query 'Targets[].Id' --output text | tr '\t' '\n' | while read target; do
        aws events remove-targets --rule $rule --ids $target || true
    done
    aws events delete-rule --name $rule || true
done

# 10. Delete Cognito User Pools
echo "👤 Cleaning up Cognito User Pools..."
aws cognito-idp list-user-pools --max-items 60 --query 'UserPools[?contains(Name, `ci-alert`)].Id' --output text | tr '\t' '\n' | while read pool; do
    echo "Deleting Cognito User Pool: $pool"
    aws cognito-idp delete-user-pool --user-pool-id $pool || true
done

# 11. Delete VPC and networking resources
echo "🌐 Cleaning up VPC resources..."
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*ci-alert*" --query 'Vpcs[].VpcId' --output text | tr '\t' '\n' | while read vpc; do
    echo "Cleaning VPC: $vpc"
    
    # Delete NAT Gateways
    aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$vpc" --query 'NatGateways[].NatGatewayId' --output text | tr '\t' '\n' | while read nat; do
        aws ec2 delete-nat-gateway --nat-gateway-id $nat || true
    done
    
    # Delete Internet Gateways
    aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpc" --query 'InternetGateways[].InternetGatewayId' --output text | tr '\t' '\n' | while read igw; do
        aws ec2 detach-internet-gateway --internet-gateway-id $igw --vpc-id $vpc || true
        aws ec2 delete-internet-gateway --internet-gateway-id $igw || true
    done
    
    # Delete subnets
    aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc" --query 'Subnets[].SubnetId' --output text | tr '\t' '\n' | while read subnet; do
        aws ec2 delete-subnet --subnet-id $subnet || true
    done
    
    # Delete route tables
    aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$vpc" --query 'RouteTables[?Associations[0].Main != `true`].RouteTableId' --output text | tr '\t' '\n' | while read rt; do
        aws ec2 delete-route-table --route-table-id $rt || true
    done
    
    # Delete security groups
    aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc" --query 'SecurityGroups[?GroupName != `default`].GroupId' --output text | tr '\t' '\n' | while read sg; do
        aws ec2 delete-security-group --group-id $sg || true
    done
    
    # Delete VPC
    aws ec2 delete-vpc --vpc-id $vpc || true
done

# 12. Delete CloudFormation stacks (in reverse order)
echo "📚 Cleaning up CloudFormation stacks..."
for stack in CIAlert-CICD CIAlert-BedrockAgent CIAlert-Monitoring CIAlert-Frontend CIAlertStack; do
    if aws cloudformation describe-stacks --stack-name $stack &>/dev/null; then
        echo "Deleting CloudFormation stack: $stack"
        aws cloudformation delete-stack --stack-name $stack || true
    fi
done

# 13. Delete IAM roles and policies
echo "🔐 Cleaning up IAM resources..."
aws iam list-roles --query 'Roles[?contains(RoleName, `ci-alert`) || contains(RoleName, `CIAlert`)].RoleName' --output text | tr '\t' '\n' | while read role; do
    echo "Deleting IAM role: $role"
    # Detach managed policies
    aws iam list-attached-role-policies --role-name $role --query 'AttachedPolicies[].PolicyArn' --output text | tr '\t' '\n' | while read policy; do
        aws iam detach-role-policy --role-name $role --policy-arn $policy || true
    done
    # Delete inline policies
    aws iam list-role-policies --role-name $role --query 'PolicyNames' --output text | tr '\t' '\n' | while read policy; do
        aws iam delete-role-policy --role-name $role --policy-name $policy || true
    done
    # Delete role
    aws iam delete-role --role-name $role || true
done

# 14. Delete custom IAM policies
aws iam list-policies --scope Local --query 'Policies[?contains(PolicyName, `ci-alert`) || contains(PolicyName, `CIAlert`)].Arn' --output text | tr '\t' '\n' | while read policy; do
    echo "Deleting IAM policy: $policy"
    aws iam delete-policy --policy-arn $policy || true
done

# 15. Delete Secrets Manager secrets
echo "🔑 Cleaning up Secrets Manager..."
aws secretsmanager list-secrets --query 'SecretList[?contains(Name, `ci-alert`)].Name' --output text | tr '\t' '\n' | while read secret; do
    echo "Deleting secret: $secret"
    aws secretsmanager delete-secret --secret-id $secret --force-delete-without-recovery || true
done

# 16. Delete CloudWatch Log Groups
echo "📊 Cleaning up CloudWatch logs..."
aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `ci-alert`) || contains(logGroupName, `/aws/lambda/ci-alert`)].logGroupName' --output text | tr '\t' '\n' | while read log_group; do
    echo "Deleting log group: $log_group"
    aws logs delete-log-group --log-group-name "$log_group" || true
done

# 17. Wait for CloudFormation stacks to delete
echo "⏳ Waiting for CloudFormation stacks to complete deletion..."
sleep 30

# 18. Final cleanup check
echo "🔍 Final cleanup verification..."
echo "Remaining S3 buckets with 'ci-alert':"
aws s3 ls | grep ci-alert || echo "None found"

echo "Remaining Lambda functions with 'ci-alert':"
aws lambda list-functions --query 'Functions[?contains(FunctionName, `ci-alert`)].FunctionName' --output text || echo "None found"

echo "Remaining DynamoDB tables:"
aws dynamodb list-tables --query 'TableNames[?contains(@, `ci-alert`) || contains(@, `Insights`) || contains(@, `Watchlist`) || contains(@, `UserSettings`)]' --output text || echo "None found"

echo "✅ Cleanup completed!"
echo "Note: Some resources may take additional time to fully delete (CloudFront distributions, etc.)"
echo "Check AWS Console to verify all resources are removed."

# Cleanup temp files
rm -f /tmp/dist-config*.json

echo "🎯 CI Alert System cleanup finished!"