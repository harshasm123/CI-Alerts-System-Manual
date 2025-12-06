#!/bin/bash

# Fix Lambda dependencies by creating deployment package
set -e

echo "🔧 Fixing Lambda dependencies..."
echo ""

# Check if python is available
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Python not found. Please install Python first:"
    echo "   Ubuntu/Debian: sudo apt update && sudo apt install python3 python3-pip -y"
    echo "   Amazon Linux: sudo yum install python3 python3-pip -y"
    exit 1
fi

# Use python or python3
PYTHON_CMD="python"
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
fi

echo "✅ Using: $PYTHON_CMD"

# Check if pip is available
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo "⚠️  pip not found. Installing pip3..."
    if command -v apt &> /dev/null; then
        # Ubuntu/Debian
        sudo apt update && sudo apt install python3-pip -y
    elif command -v yum &> /dev/null; then
        # Amazon Linux
        sudo yum install python3-pip -y
    else
        echo "❌ Cannot auto-install pip. Please install manually:"
        echo "   Ubuntu/Debian: sudo apt install python3-pip"
        echo "   Amazon Linux: sudo yum install python3-pip"
        exit 1
    fi
fi

# Use pip or pip3
PIP_CMD="pip"
if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
fi

echo "✅ Using: $PIP_CMD"

# Get region
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
fi

# Get function name dynamically
FUNCTION_NAME=$(aws lambda list-functions --region $REGION --query "Functions[?contains(FunctionName, 'PubMedFunction')].FunctionName" --output text)

if [ -z "$FUNCTION_NAME" ]; then
    echo "❌ PubMed function not found in region $REGION"
    exit 1
fi

echo "📋 Function: $FUNCTION_NAME"
echo "📋 Region: $REGION"
echo ""

# Create temp directory
TEMP_DIR="lambda-package-temp"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR
cd $TEMP_DIR

# Copy Lambda code
cp ../lambdas/ingestion/pubmed_ingestion.py .

# Install dependencies
echo "📦 Installing dependencies..."
$PYTHON_CMD -m pip install requests boto3 -t . --quiet

# Create deployment package
echo "📦 Creating deployment package..."
if ! command -v zip &> /dev/null; then
    echo "⚠️  zip not found. Installing..."
    if command -v apt &> /dev/null; then
        sudo apt install zip -y
    elif command -v yum &> /dev/null; then
        sudo yum install zip -y
    else
        echo "❌ Cannot install zip. Please install manually: sudo apt install zip"
        exit 1
    fi
fi

zip -r -q pubmed-function.zip .

# Update Lambda function
echo "📦 Updating Lambda function..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://pubmed-function.zip \
    --region $REGION

echo "⏳ Waiting for update to complete..."
aws lambda wait function-updated \
    --function-name $FUNCTION_NAME \
    --region $REGION

echo ""
echo "✅ Lambda function updated with dependencies!"

# Cleanup
cd ..
rm -rf $TEMP_DIR

echo ""
echo "🧪 Test the function:"
echo "   aws lambda invoke --function-name $FUNCTION_NAME --region $REGION response.json"