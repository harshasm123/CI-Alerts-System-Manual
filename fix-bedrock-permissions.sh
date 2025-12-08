#!/bin/bash

echo "Fixing Bedrock Agent Permissions..."

# Get agent service role ARN
echo "Getting agent service role..."
ROLE_ARN=$(aws bedrock-agent get-agent --agent-id HCGMGHWP6O --region us-west-2 --query "agent.agentResourceRoleArn" --output text)

# Extract role name from ARN
ROLE_NAME=$(echo $ROLE_ARN | cut -d'/' -f2)
echo "Role name: $ROLE_NAME"

# Apply the policy
echo "Applying Bedrock permissions policy..."
aws iam put-role-policy --role-name $ROLE_NAME --policy-name BedrockAgentPolicy --policy-document file://bedrock-agent-policy.json

# Verify the policy was applied
echo "Verifying policy..."
aws iam get-role-policy --role-name $ROLE_NAME --policy-name BedrockAgentPolicy

echo "Done! Agent should now have proper permissions."