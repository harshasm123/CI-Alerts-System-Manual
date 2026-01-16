#!/bin/bash

# Setup Cloudflare for CI Alert System Frontend

set -e

echo "☁️ Setting up Cloudflare for CI Alert System"
echo "============================================"
echo ""

# Get backend configuration
REGION=$(aws configure get region || echo "us-west-2")
API_URL=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name CIAlertStack --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)

echo "📋 Backend Configuration:"
echo "  API URL: $API_URL"
echo "  User Pool: $USER_POOL_ID"
echo "  Region: $REGION"
echo ""

# Build frontend
echo "🔨 Building frontend..."
cd frontend

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_REGION=$REGION
GENERATE_SOURCEMAP=false
EOF

echo "✅ Environment configured"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🏗️ Building production bundle..."
npm run build

cd ..

echo ""
echo "✅ Frontend built successfully!"
echo ""
echo "📝 Cloudflare Pages Setup Instructions:"
echo "========================================"
echo ""
echo "1️⃣ Create Cloudflare Account (if needed):"
echo "   • Go to: https://dash.cloudflare.com/sign-up"
echo "   • Sign up with your email"
echo ""
echo "2️⃣ Deploy to Cloudflare Pages:"
echo ""
echo "   Option A: Direct Upload (Fastest)"
echo "   ---------------------------------"
echo "   • Go to: https://dash.cloudflare.com"
echo "   • Click 'Workers & Pages' → 'Create application' → 'Pages'"
echo "   • Click 'Upload assets'"
echo "   • Project name: ci-alert-system"
echo "   • Drag and drop the 'frontend/build' folder"
echo "   • Click 'Deploy site'"
echo ""
echo "   Option B: GitHub Integration (Recommended)"
echo "   ------------------------------------------"
echo "   • Push code to GitHub"
echo "   • Go to: https://dash.cloudflare.com"
echo "   • Click 'Workers & Pages' → 'Create application' → 'Pages'"
echo "   • Click 'Connect to Git'"
echo "   • Select your repository"
echo "   • Build settings:"
echo "     - Framework preset: Create React App"
echo "     - Build command: npm run build"
echo "     - Build output directory: build"
echo "     - Root directory: frontend"
echo "   • Environment variables:"
echo "     REACT_APP_API_URL=$API_URL"
echo "     REACT_APP_USER_POOL_ID=$USER_POOL_ID"
echo "     REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID"
echo "     REACT_APP_REGION=$REGION"
echo "   • Click 'Save and Deploy'"
echo ""
echo "3️⃣ Configure Custom Domain (Optional):"
echo "   • In Cloudflare Pages → Your project → 'Custom domains'"
echo "   • Click 'Set up a custom domain'"
echo "   • Enter: ci-alert.yourdomain.com"
echo "   • Follow DNS setup instructions"
echo ""
echo "4️⃣ Enable HTTPS & Security:"
echo "   • SSL/TLS: Full (strict)"
echo "   • Always Use HTTPS: On"
echo "   • Automatic HTTPS Rewrites: On"
echo "   • Minimum TLS Version: 1.2"
echo ""
echo "5️⃣ Configure CORS (if needed):"
echo "   • Add _headers file to frontend/public:"
cat > frontend/public/_headers << 'HEADERS'
/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
HEADERS
echo "   ✅ Created _headers file"
echo ""
echo "6️⃣ Performance Optimization:"
echo "   • Cloudflare Pages → Settings → 'Build & deployments'"
echo "   • Enable: Automatic deployments"
echo "   • Enable: Preview deployments"
echo "   • Enable: Build caching"
echo ""
echo "📊 Cloudflare Benefits:"
echo "  ✅ Free hosting (unlimited bandwidth)"
echo "  ✅ Global CDN (300+ locations)"
echo "  ✅ Automatic HTTPS"
echo "  ✅ DDoS protection"
echo "  ✅ Fast builds (< 1 minute)"
echo "  ✅ Preview deployments"
echo "  ✅ Automatic deployments from Git"
echo ""
echo "💰 Cost Comparison:"
echo "  Cloudflare Pages: $0/month (free tier)"
echo "  AWS S3 + CloudFront: $5-10/month"
echo "  AWS ALB + ECS: $45-60/month"
echo ""
echo "🚀 Quick Deploy Command:"
echo "  npx wrangler pages deploy frontend/build --project-name=ci-alert-system"
echo ""
echo "📝 After deployment, update Cognito callback URLs:"
echo "  aws cognito-idp update-user-pool-client \\"
echo "    --user-pool-id $USER_POOL_ID \\"
echo "    --client-id $USER_POOL_CLIENT_ID \\"
echo "    --callback-urls https://your-site.pages.dev \\"
echo "    --logout-urls https://your-site.pages.dev \\"
echo "    --region $REGION"
echo ""
echo "✅ Setup complete! Follow the instructions above to deploy."
