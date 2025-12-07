#!/bin/bash

echo "📧 Setting up Amazon SES..."

# Get region
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

echo "Region: $REGION"
echo ""

# Verify email address
read -p "Enter your email address to verify for SES: " EMAIL

echo ""
echo "📨 Verifying email: $EMAIL"
aws ses verify-email-identity --email-address $EMAIL --region $REGION

echo ""
echo "✅ Verification email sent to $EMAIL"
echo ""
echo "⚠️  IMPORTANT: Check your inbox and click the verification link!"
echo ""
echo "After verification, update the Lambda environment variable:"
echo "  FROM_EMAIL=$EMAIL"
echo ""
echo "To check verification status:"
echo "  aws ses get-identity-verification-attributes --identities $EMAIL --region $REGION"
echo ""
echo "To test sending:"
echo "  aws ses send-email --from $EMAIL --to $EMAIL --subject 'Test' --text 'Test email' --region $REGION"
