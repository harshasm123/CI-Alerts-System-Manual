#!/bin/bash

# EC2-Only Deployment (NOT RECOMMENDED)
# This converts the serverless architecture to EC2-based

echo "⚠️  WARNING: EC2-only deployment is NOT recommended"
echo "   Current serverless architecture is better in every way"
echo "   Proceed only if you have specific requirements"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled. Use 'bash deploy.sh' for recommended serverless deployment."
    exit 1
fi

# EC2 Instance Setup
INSTANCE_TYPE="t3.medium"  # $30/month
REGION="us-east-1"
KEY_NAME="ci-alert-key"

echo "🚀 Setting up EC2-based CI Alert System"

# 1. Create EC2 instances
echo "📦 Creating EC2 instances..."

# Frontend EC2
aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \
    --count 1 \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids sg-web \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=CI-Alert-Frontend}]'

# Backend EC2  
aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \
    --count 1 \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids sg-api \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=CI-Alert-Backend}]'

# 2. Setup RDS Database (replaces DynamoDB)
echo "🗄️  Creating RDS database..."
aws rds create-db-instance \
    --db-instance-identifier ci-alert-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --master-username admin \
    --master-user-password SecurePassword123! \
    --allocated-storage 20

# 3. Create Application Load Balancer
echo "⚖️  Creating load balancer..."
aws elbv2 create-load-balancer \
    --name ci-alert-alb \
    --subnets subnet-12345 subnet-67890 \
    --security-groups sg-alb

echo ""
echo "❌ STOP: This approach requires:"
echo "1. Complete application rewrite"
echo "2. 4x higher costs"
echo "3. Manual server management"
echo "4. Custom authentication system"
echo "5. Database migration scripts"
echo ""
echo "✅ RECOMMENDED: Use serverless deployment instead:"
echo "   bash deploy.sh"
echo ""
echo "💡 If you need EC2 for compliance, consider:"
echo "   - AWS Outposts (AWS services on-premises)"
echo "   - ECS Fargate (containerized serverless)"
echo "   - Hybrid architecture (frontend on EC2, backend serverless)"