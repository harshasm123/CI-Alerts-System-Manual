#!/bin/bash

# Upload sample pharmaceutical data to knowledge base

KB_BUCKET=$(aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --query 'Stacks[0].Outputs[?OutputKey==`DataSourceBucket`].OutputValue' --output text)

echo "📚 Uploading sample data to knowledge base: $KB_BUCKET"

# Create sample documents
mkdir -p sample-docs/documents/{regulatory,clinical-trials,patents,market-research,literature}

# Sample FDA approval letter
cat > sample-docs/documents/regulatory/keytruda-fda-approval.txt << 'EOF'
FDA APPROVAL LETTER - KEYTRUDA (pembrolizumab)

Date: September 4, 2014
Application: BLA 125514

INDICATION: Treatment of patients with unresectable or metastatic melanoma and disease progression following ipilimumab and, if BRAF V600 mutation positive, a BRAF inhibitor.

DOSAGE: 2 mg/kg administered as an intravenous infusion over 30 minutes every 3 weeks.

MECHANISM: Keytruda is a humanized monoclonal antibody that blocks the interaction between PD-1 and its ligands, PD-L1 and PD-L2.

CLINICAL TRIALS: Based on tumor response rate and durability of response from KEYNOTE-001 study (n=173 patients).

ACCELERATED APPROVAL: Granted under accelerated approval based on tumor response rate. Continued approval may be contingent upon verification of clinical benefit in confirmatory trials.
EOF

# Sample clinical trial protocol
cat > sample-docs/documents/clinical-trials/keynote-189-protocol.txt << 'EOF'
KEYNOTE-189 CLINICAL TRIAL PROTOCOL

Title: Pembrolizumab plus Pemetrexed and Platinum Chemotherapy for Metastatic Nonsquamous Non-Small-Cell Lung Cancer

Phase: III, Randomized, Double-blind, Placebo-controlled

Primary Endpoint: Overall survival (OS) and progression-free survival (PFS)

Study Population: 
- Metastatic nonsquamous NSCLC
- No prior systemic therapy
- ECOG performance status 0-1
- No EGFR/ALK alterations

Treatment Arms:
- Arm A: Pembrolizumab 200mg + pemetrexed + carboplatin/cisplatin
- Arm B: Placebo + pemetrexed + carboplatin/cisplatin

Sample Size: 616 patients
Primary Analysis: Event-driven analysis after 308 deaths
EOF

# Sample patent document
cat > sample-docs/documents/patents/pd1-antibody-patent.txt << 'EOF'
PATENT: Anti-PD-1 Antibodies and Uses Thereof

Patent Number: US 8,008,449
Filing Date: October 10, 2008
Grant Date: August 30, 2011
Assignee: Merck Sharp & Dohme Corp.

ABSTRACT: The present invention provides isolated monoclonal antibodies that bind to PD-1 with high affinity. Nucleic acids encoding the antibodies, expression vectors, host cells, and methods for expressing the antibodies are also provided.

CLAIMS:
1. An isolated monoclonal antibody that binds to human PD-1
2. The antibody of claim 1, wherein the antibody is pembrolizumab
3. A pharmaceutical composition comprising the antibody of claim 1

COMMERCIAL IMPACT: This patent covers the composition of matter for pembrolizumab (Keytruda), representing billions in revenue for Merck.
EOF

# Sample market research
cat > sample-docs/documents/market-research/pd1-market-analysis.txt << 'EOF'
PD-1/PD-L1 INHIBITOR MARKET ANALYSIS 2024

Market Size: $38.1 billion (2023), projected $80.8 billion by 2030

Key Players:
1. Keytruda (pembrolizumab) - Merck: $25.0B revenue (2023)
2. Opdivo (nivolumab) - BMS: $7.5B revenue (2023)  
3. Tecentriq (atezolizumab) - Roche: $3.2B revenue (2023)
4. Imfinzi (durvalumab) - AstraZeneca: $2.8B revenue (2023)

Growth Drivers:
- Expanding indications (first-line NSCLC, adjuvant settings)
- Combination therapies
- Emerging markets penetration

Competitive Threats:
- Biosimilars entering market (2028-2030)
- Next-generation immunotherapies
- CAR-T cell therapies in solid tumors

Investment Thesis: Keytruda maintains leadership through superior clinical data and first-mover advantage in key indications.
EOF

# Sample scientific literature
cat > sample-docs/documents/literature/pd1-mechanism-review.txt << 'EOF'
REVIEW: PD-1/PD-L1 Pathway in Cancer Immunotherapy

Authors: Sharma P, Allison JP
Journal: Science, 2015

ABSTRACT: The programmed death-1 (PD-1) pathway is a critical immune checkpoint that regulates T-cell activation and tolerance. PD-1 is expressed on activated T cells and binds to PD-L1 and PD-L2 on antigen-presenting cells and tumor cells.

MECHANISM OF ACTION:
- PD-1 engagement delivers inhibitory signals to T cells
- Tumor cells exploit this pathway to evade immune surveillance
- Anti-PD-1 antibodies block this interaction, restoring T-cell function

CLINICAL APPLICATIONS:
- Melanoma: First approved indication, durable responses
- NSCLC: Combination with chemotherapy improves survival
- Renal cell carcinoma: Active in treatment-naive patients
- Head and neck cancer: Effective in recurrent/metastatic disease

RESISTANCE MECHANISMS:
- Lack of tumor-infiltrating lymphocytes
- Immunosuppressive tumor microenvironment
- Alternative immune checkpoints (LAG-3, TIM-3)

FUTURE DIRECTIONS: Combination strategies, biomarker development, overcoming resistance
EOF

# Upload to S3
echo "📤 Uploading documents..."
aws s3 cp sample-docs/ s3://$KB_BUCKET/ --recursive

echo "✅ Sample data uploaded successfully!"
echo ""
echo "📋 Uploaded files:"
aws s3 ls s3://$KB_BUCKET/documents/ --recursive

# Start ingestion job
KB_ID=$(aws cloudformation describe-stacks --stack-name CIAlert-KnowledgeBase --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
DS_ID=$(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --query 'dataSourceSummaries[0].dataSourceId' --output text)

echo ""
echo "🔄 Starting knowledge base ingestion..."
aws bedrock-agent start-ingestion-job --knowledge-base-id $KB_ID --data-source-id $DS_ID

echo "✅ Ingestion job started. Check status with:"
echo "aws bedrock-agent list-ingestion-jobs --knowledge-base-id $KB_ID"

# Cleanup
rm -rf sample-docs/