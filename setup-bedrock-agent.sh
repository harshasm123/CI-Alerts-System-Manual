#!/bin/bash
set -e

echo "🤖 Setting up Bedrock Agent for AI Assistant..."
echo ""
echo "⚠️  IMPORTANT: Bedrock Agent requires manual setup in AWS Console"
echo "    CloudFormation doesn't support automated agent creation yet."
echo ""

# Get required resources
INSIGHTS_TABLE=$(aws dynamodb list-tables --region us-west-2 --query 'TableNames[?contains(@,`InsightsTable`)]' --output text)
DATA_BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region us-west-2 --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)
ACTION_HANDLER=$(aws lambda list-functions --region us-west-2 --query 'Functions[?contains(FunctionName,`ActionHandler`)].FunctionArn' --output text)

echo "📋 Your Resources:"
echo "   Insights Table: $INSIGHTS_TABLE"
echo "   Data Bucket: $DATA_BUCKET"
echo "   Action Handler: $ACTION_HANDLER"
echo ""

echo "📝 Manual Setup Steps:"
echo ""
echo "1️⃣  Enable Bedrock Models (if not already done):"
echo "   • Go to: https://console.aws.amazon.com/bedrock/home?region=us-west-2#/modelaccess"
echo "   • Enable: Claude 3.5 Sonnet v2, Claude 3 Haiku, Titan Embeddings"
echo ""

echo "2️⃣  Create Knowledge Base:"
echo "   • Go to: https://console.aws.amazon.com/bedrock/home?region=us-west-2#/knowledge-bases"
echo "   • Click 'Create knowledge base'"
echo "   • Name: ci-alert-knowledge-base"
echo "   • S3 bucket: $DATA_BUCKET"
echo "   • Embedding model: amazon.titan-embed-text-v2:0"
echo "   • Click 'Create'"
echo "   • Copy the Knowledge Base ID"
echo ""

echo "3️⃣  Create Bedrock Agent:"
echo "   • Go to: https://console.aws.amazon.com/bedrock/home?region=us-west-2#/agents"
echo "   • Click 'Create Agent'"
echo "   • Agent name: ci-alert-agent"
echo "   • Model: Claude 3.5 Sonnet v2"
echo "   • Instructions:"
echo ""
cat << 'EOF'
You are a pharmaceutical competitive intelligence analyst assistant. 
You have access to:
- A knowledge base with clinical trial data, FDA approvals, and market intelligence
- Real-time insights from DynamoDB about tracked molecules
- Historical data and trends

When answering questions:
1. Search the knowledge base for relevant documents
2. Query DynamoDB for recent insights
3. Provide data-driven analysis with citations
4. Highlight competitive risks and opportunities
5. Include relevant sources and confidence scores

Be concise, accurate, and focus on actionable intelligence.
EOF
echo ""
echo "   • Click 'Create'"
echo "   • Copy the Agent ID"
echo ""

echo "4️⃣  Add Knowledge Base to Agent:"
echo "   • In your agent, go to 'Knowledge bases' tab"
echo "   • Click 'Add knowledge base'"
echo "   • Select: ci-alert-knowledge-base"
echo "   • Instructions: 'Search for clinical trials, FDA approvals, and market data'"
echo "   • Save"
echo ""

echo "5️⃣  Create Agent Alias:"
echo "   • In your agent, go to 'Aliases' tab"
echo "   • Click 'Create alias'"
echo "   • Name: prod"
echo "   • Click 'Create'"
echo "   • Copy the Alias ID"
echo ""

echo "6️⃣  Update Lambda with Agent IDs:"
echo "   Run these commands with your IDs:"
echo ""
echo "   AGENT_ID='YOUR_AGENT_ID'"
echo "   ALIAS_ID='YOUR_ALIAS_ID'"
echo "   KB_ID='YOUR_KNOWLEDGE_BASE_ID'"
echo ""
echo "   AGENT_FUNC=\$(aws lambda list-functions --region us-west-2 --query 'Functions[?contains(FunctionName,\`AgentFunction\`)].FunctionName' --output text)"
echo ""
echo "   aws lambda update-function-configuration \\"
echo "     --function-name \$AGENT_FUNC \\"
echo "     --environment Variables=\"{AGENT_ID=\$AGENT_ID,AGENT_ALIAS_ID=\$ALIAS_ID,KNOWLEDGE_BASE_ID=\$KB_ID}\" \\"
echo "     --region us-west-2"
echo ""

echo "7️⃣  Test the Agent:"
echo "   • In Bedrock console, go to your agent"
echo "   • Click 'Test' button"
echo "   • Ask: 'What are the latest insights on Keytruda?'"
echo "   • Verify it responds correctly"
echo ""

echo "✅ After completing these steps, the AI Assistant will work in your app!"
echo ""
echo "💡 Tip: Upload sample documents to $DATA_BUCKET to populate the knowledge base"
