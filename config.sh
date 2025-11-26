#!/bin/bash

# Configuration script - Set region and account dynamically

echo "🔧 CI Alert System Configuration"
echo ""

# Get current settings
CURRENT_REGION=$(aws configure get region)
CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

echo "Current Configuration:"
echo "  Account: ${CURRENT_ACCOUNT:-Not configured}"
echo "  Region: ${CURRENT_REGION:-Not configured}"
echo ""

# Prompt for region
echo "Available regions (recommended):"
echo "  1. us-east-1 (N. Virginia) - Default, most services"
echo "  2. us-west-1 (N. California)"
echo "  3. eu-west-1 (Ireland)"
echo "  4. ap-southeast-1 (Singapore)"
echo "  5. Custom region"
echo ""

read -p "Select region [1-5] (default: 1): " choice

case $choice in
    2) NEW_REGION="us-west-1" ;;
    3) NEW_REGION="eu-west-1" ;;
    4) NEW_REGION="ap-southeast-1" ;;
    5) 
        read -p "Enter custom region: " NEW_REGION
        ;;
    *)
        NEW_REGION="us-east-1"
        ;;
esac

# Set region
aws configure set region $NEW_REGION
echo "✅ Region set to: $NEW_REGION"

# Optional: Set alert email for monitoring
echo ""
read -p "Enter alert email for monitoring (optional): " ALERT_EMAIL
if [ -n "$ALERT_EMAIL" ]; then
    export ALERT_EMAIL
    echo "export ALERT_EMAIL=$ALERT_EMAIL" >> ~/.bashrc
    echo "✅ Alert email set to: $ALERT_EMAIL"
fi

echo ""
echo "Configuration complete!"
echo "  Region: $(aws configure get region)"
echo "  Account: $(aws sts get-caller-identity --query Account --output text)"
echo ""
echo "Next: ./deploy.sh"
