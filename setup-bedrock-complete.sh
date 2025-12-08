#!/bin/bash
set -e

echo "🤖 Complete Bedrock Agent + Knowledge Base Setup Guide"
echo "========================================================"
echo ""

# Get resources
DATA_BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region us-west-2 --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)
INSIGHTS_TABLE=$(aws dynamodb list-tables --region us-west-2 --query 'TableNames[?contains(@,`InsightsTable`)]' --output text)

echo "📋 Your Resources:"
echo "   S3 Bucket: $DATA_BUCKET"
echo "   DynamoDB Table: $INSIGHTS_TABLE"
echo "   Region: us-west-2"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Enable Bedrock Models"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://us-west-2.console.aws.amazon.com/bedrock/home?region=us-west-2#/modelaccess"
echo "2. Click 'Manage model access'"
echo "3. Enable these models:"
echo "   ✓ Claude 3.5 Sonnet v2 (anthropic.claude-3-5-sonnet-20241022-v2:0)"
echo "   ✓ Claude 3 Haiku (anthropic.claude-3-haiku-20240307-v1:0)"
echo "   ✓ Titan Embeddings G1 (amazon.titan-embed-text-v2:0)"
echo "4. Click 'Save changes'"
echo ""
read -p "Press Enter after enabling models..."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Upload Sample Documents to S3"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Creating sample pharmaceutical documents..."

# Create sample documents
mkdir -p /tmp/kb-docs

cat > /tmp/kb-docs/keytruda-overview.txt << 'EOF'
Keytruda (Pembrolizumab) - Competitive Intelligence Brief

Drug Name: Keytruda (pembrolizumab)
Manufacturer: Merck & Co.
Approval Date: September 4, 2014
Mechanism: PD-1 inhibitor (immune checkpoint inhibitor)

Market Performance:
- 2023 Revenue: $20.9 billion
- Growth Rate: 18% YoY
- Market Share: Leading PD-1 inhibitor

Approved Indications:
1. Melanoma (first-line and adjuvant)
2. Non-small cell lung cancer (NSCLC)
3. Head and neck squamous cell carcinoma
4. Classical Hodgkin lymphoma
5. Primary mediastinal large B-cell lymphoma
6. Urothelial carcinoma
7. Microsatellite instability-high (MSI-H) cancers
8. Gastric cancer
9. Cervical cancer
10. Hepatocellular carcinoma
11. Merkel cell carcinoma
12. Renal cell carcinoma
13. Endometrial carcinoma
14. Tumor mutational burden-high (TMB-H) cancers

Competitive Landscape:
- Main Competitors: Opdivo (BMS), Tecentriq (Roche), Imfinzi (AstraZeneca)
- Differentiation: Broader indication portfolio, strong clinical data
- Patent Expiry: 2028 (US)

Key Clinical Trials:
- KEYNOTE-001: Melanoma breakthrough
- KEYNOTE-024: First-line NSCLC
- KEYNOTE-189: NSCLC combination therapy
- KEYNOTE-426: Renal cell carcinoma

Strategic Threats:
1. Biosimilar competition post-2028
2. Next-generation immunotherapies
3. Combination therapy competition
4. Pricing pressure from payers

Opportunities:
1. Additional indication expansions
2. Combination therapy approvals
3. Adjuvant/neoadjuvant settings
4. International market expansion
EOF

cat > /tmp/kb-docs/humira-biosimilars.txt << 'EOF'
Humira Biosimilar Competition Analysis

Original Drug: Humira (adalimumab)
Manufacturer: AbbVie
Patent Expiry: January 2023 (US)
2022 Revenue: $21.2 billion

Approved Biosimilars (US):
1. Amjevita (Amgen) - Launched January 2023
2. Cyltezo (Boehringer Ingelheim) - Launched July 2023
3. Hyrimoz (Sandoz) - Launched October 2023
4. Hadlima (Samsung Bioepis) - Launched July 2023
5. Hulio (Mylan/Viatris) - Launched July 2023
6. Abrilada (Pfizer) - Launched November 2023
7. Yusimry (Coherus) - Launched December 2023
8. Idacio (Fresenius Kabi) - Launched January 2024

Market Impact:
- Expected erosion: 30-40% by 2025
- Pricing: 5-55% discount to Humira
- Interchangeability: Cyltezo (first interchangeable)

AbbVie Defense Strategy:
1. Rinvoq (upadacitinib) - Next-gen JAK inhibitor
2. Skyrizi (risankizumab) - IL-23 inhibitor
3. Patient support programs
4. Authorized generic strategy

Competitive Intelligence:
- Monitor biosimilar uptake rates
- Track payer formulary changes
- Analyze physician switching patterns
- Watch for combination therapy approvals

Market Forecast:
- 2024: Humira $15B (-29%)
- 2025: Humira $12B (-20%)
- 2026: Humira $10B (-17%)
- Biosimilar market: $8B by 2026
EOF

cat > /tmp/kb-docs/car-t-landscape.txt << 'EOF'
CAR-T Therapy Competitive Landscape

Market Overview:
- 2023 Market Size: $4.2 billion
- Projected 2030: $15.8 billion
- CAGR: 20.1%

Approved CAR-T Therapies:

1. Kymriah (tisagenlecleucel) - Novartis
   - Indications: ALL, DLBCL
   - Approval: August 2017
   - 2023 Sales: $650M

2. Yescarta (axicabtagene ciloleucel) - Gilead/Kite
   - Indications: DLBCL, FL, MCL
   - Approval: October 2017
   - 2023 Sales: $1.2B

3. Tecartus (brexucabtagene autoleucel) - Gilead/Kite
   - Indications: MCL, ALL
   - Approval: July 2020
   - 2023 Sales: $450M

4. Breyanzi (lisocabtagene maraleucel) - BMS
   - Indications: DLBCL, FL
   - Approval: February 2021
   - 2023 Sales: $550M

5. Abecma (idecabtagene vicleucel) - BMS/bluebird
   - Indications: Multiple myeloma
   - Approval: March 2021
   - 2023 Sales: $480M

6. Carvykti (ciltacabtagene autoleucel) - J&J/Legend
   - Indications: Multiple myeloma
   - Approval: February 2022
   - 2023 Sales: $380M

Pipeline Developments:
- Allogeneic (off-the-shelf) CAR-T
- Solid tumor CAR-T
- Dual-targeting CAR-T
- Armored CAR-T with cytokines

Key Challenges:
1. Manufacturing complexity
2. High cost ($400K-$500K per treatment)
3. Cytokine release syndrome (CRS)
4. Neurotoxicity
5. Limited durability in some patients

Competitive Advantages:
- First-mover advantage (Kymriah, Yescarta)
- Manufacturing efficiency
- Safety profile
- Durability of response
- Outpatient administration capability

Market Trends:
- Earlier line therapy approvals
- Combination with checkpoint inhibitors
- Allogeneic CAR-T development
- Solid tumor expansion
- International market growth
EOF

# Upload to S3
echo "Uploading documents to S3..."
aws s3 cp /tmp/kb-docs/ s3://$DATA_BUCKET/knowledge-base/ --recursive --region us-west-2

echo "✅ Uploaded 3 sample documents"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Create Knowledge Base"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://us-west-2.console.aws.amazon.com/bedrock/home?region=us-west-2#/knowledge-bases"
echo "2. Click 'Create knowledge base'"
echo "3. Configuration:"
echo "   • Name: ci-alert-knowledge-base"
echo "   • Description: Pharmaceutical competitive intelligence data"
echo "   • IAM Role: Create new service role"
echo "4. Data source:"
echo "   • S3 URI: s3://$DATA_BUCKET/knowledge-base/"
echo "   • Chunking: Default (300 tokens, 20% overlap)"
echo "5. Embeddings:"
echo "   • Model: Titan Embeddings G1 - Text v2.0"
echo "   • Dimensions: 1024"
echo "6. Vector database:"
echo "   • Quick create new vector store (OpenSearch Serverless)"
echo "7. Click 'Create'"
echo "8. Wait for sync to complete (~5 minutes)"
echo ""
read -p "Press Enter after Knowledge Base is created and synced..."
echo ""
echo "Enter your Knowledge Base ID:"
read KB_ID

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Create Bedrock Agent"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://us-west-2.console.aws.amazon.com/bedrock/home?region=us-west-2#/agents"
echo "2. Click 'Create Agent'"
echo "3. Agent details:"
echo "   • Name: ci-alert-agent"
echo "   • Description: Pharmaceutical competitive intelligence assistant"
echo "4. Model selection:"
echo "   • Model: Claude 3.5 Sonnet v2"
echo "5. Instructions (copy this):"
echo ""
cat << 'INSTRUCTIONS'
You are a pharmaceutical competitive intelligence analyst assistant with expertise in drug development, market analysis, and regulatory affairs.

Your capabilities:
- Access to a knowledge base with clinical trial data, FDA approvals, biosimilar competition, and market intelligence
- Real-time insights about tracked molecules from the CI Alert System
- Historical trends and competitive landscape analysis

When responding:
1. Search the knowledge base for relevant information
2. Provide data-driven analysis with specific numbers and dates
3. Cite sources from the knowledge base
4. Highlight competitive risks and opportunities
5. Be concise and actionable
6. Include confidence scores when appropriate

Focus areas:
- Drug approvals and pipeline updates
- Biosimilar competition and patent cliffs
- Clinical trial results and regulatory milestones
- Market share and revenue trends
- Competitive positioning and strategic threats
INSTRUCTIONS
echo ""
echo "6. Click 'Create'"
echo ""
read -p "Press Enter after Agent is created..."
echo ""
echo "Enter your Agent ID:"
read AGENT_ID

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 5: Link Knowledge Base to Agent"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. In your agent page, scroll to 'Knowledge bases'"
echo "2. Click 'Add knowledge base'"
echo "3. Select: ci-alert-knowledge-base"
echo "4. Instructions for KB:"
echo "   'Search for clinical trials, FDA approvals, biosimilar competition, market data, and competitive intelligence about pharmaceutical molecules.'"
echo "5. Click 'Add'"
echo ""
read -p "Press Enter after linking Knowledge Base..."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 6: Create Agent Alias"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. In your agent, go to 'Aliases' section"
echo "2. Click 'Create alias'"
echo "3. Alias name: prod"
echo "4. Description: Production alias"
echo "5. Click 'Create'"
echo ""
read -p "Press Enter after creating alias..."
echo ""
echo "Enter your Alias ID:"
read ALIAS_ID

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 7: Update Lambda Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

AGENT_FUNC=$(aws lambda list-functions --region us-west-2 --query 'Functions[?contains(FunctionName,`AgentFunction`)].FunctionName' --output text)

echo "Updating Lambda function: $AGENT_FUNC"
aws lambda update-function-configuration \
  --function-name $AGENT_FUNC \
  --environment Variables="{AGENT_ID=$AGENT_ID,AGENT_ALIAS_ID=$ALIAS_ID,KNOWLEDGE_BASE_ID=$KB_ID}" \
  --region us-west-2

echo "✅ Lambda updated!"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 8: Test the Agent"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go back to your agent in Bedrock console"
echo "2. Click 'Test' button in top right"
echo "3. Try these queries:"
echo "   • 'What are the key facts about Keytruda?'"
echo "   • 'Tell me about Humira biosimilar competition'"
echo "   • 'What CAR-T therapies are approved?'"
echo ""
echo "4. Verify responses include:"
echo "   ✓ Relevant information from knowledge base"
echo "   ✓ Citations with source documents"
echo "   ✓ Accurate data and numbers"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SETUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your AI Assistant is now configured:"
echo "  • Agent ID: $AGENT_ID"
echo "  • Alias ID: $ALIAS_ID"
echo "  • Knowledge Base ID: $KB_ID"
echo ""
echo "🌐 Test in your app:"
echo "   http://ci-alert-frontend-alb-530900495.us-west-2.elb.amazonaws.com"
echo "   Go to 'AI Assistant' tab and ask questions!"
echo ""
echo "💡 To add more documents:"
echo "   aws s3 cp your-doc.txt s3://$DATA_BUCKET/knowledge-base/"
echo "   Then sync KB in Bedrock console"
