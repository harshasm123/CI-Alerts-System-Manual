#!/bin/bash

# Connect Knowledge Base to Bedrock Agent after deployment

echo "🔗 Connecting Knowledge Base to Bedrock Agent..."

REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

# Get IDs from stack outputs
KB_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null)
AGENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-BedrockAgent --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`AgentIdOutput`].OutputValue' --output text 2>/dev/null)

if [ -z "$KB_ID" ] || [ -z "$AGENT_ID" ]; then
    echo "❌ Could not get Knowledge Base ID or Agent ID from stack outputs"
    echo "   KB_ID: $KB_ID"
    echo "   AGENT_ID: $AGENT_ID"
    exit 1
fi

echo "📋 Configuration:"
echo "  Knowledge Base ID: $KB_ID"
echo "  Agent ID: $AGENT_ID"

# Associate knowledge base with agent
echo "🤖 Associating Knowledge Base with Bedrock Agent..."
aws bedrock-agent associate-agent-knowledge-base \
    --agent-id $AGENT_ID \
    --agent-version DRAFT \
    --knowledge-base-id $KB_ID \
    --description "Pharmaceutical competitive intelligence knowledge base" \
    --knowledge-base-state ENABLED \
    --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ Knowledge Base associated with Agent successfully"
    
    # Prepare agent to apply changes
    echo "🔄 Preparing agent with knowledge base..."
    aws bedrock-agent prepare-agent --agent-id $AGENT_ID --region $REGION
    
    if [ $? -eq 0 ]; then
        echo "✅ Agent prepared with knowledge base successfully"
        echo ""
        echo "🎉 Knowledge Base connection complete!"
        echo "   Your Bedrock Agent now has access to RAG capabilities"
    else
        echo "⚠️  Agent preparation failed, but association succeeded"
        echo "   You may need to prepare the agent manually"
    fi
else
    echo "❌ Failed to associate Knowledge Base with Agent"
    echo "   This may be because the association already exists"
fi

echo ""
echo "📝 Next Steps:"
echo "1. Upload documents: ./upload-sample-data.sh"
echo "2. Test RAG search: Ask agent 'Search for Keytruda FDA approval'"
echo "3. Monitor ingestion: aws bedrock-agent list-ingestion-jobs --knowledge-base-id $KB_ID"