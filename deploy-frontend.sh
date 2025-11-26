#!/bin/bash

# Build and Deploy React Frontend

set -e

echo "🎨 Building and Deploying React Frontend"
echo ""

REGION=$(aws configure get region)

# Get API URL from Core stack
API_URL=$(aws cloudformation describe-stacks \
  --stack-name CIAlertStack \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name CIAlertStack \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name CIAlertStack \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

echo "📋 Configuration:"
echo "  API URL: $API_URL"
echo "  User Pool: $USER_POOL_ID"
echo "  Client ID: $USER_POOL_CLIENT_ID"
echo ""

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
  echo "❌ Frontend directory not found"
  echo "   Creating basic React app..."
  
  # Create basic frontend structure
  mkdir -p frontend/public frontend/src
  
  # Create package.json
  cat > frontend/package.json << 'EOF'
{
  "name": "ci-alert-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": ["react-app"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
EOF

  # Create public/index.html
  cat > frontend/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CI Alert System</title>
</head>
<body>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <div id="root"></div>
</body>
</html>
EOF

  # Create src/index.js
  cat > frontend/src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
EOF

  # Create src/App.js with API URL
  cat > frontend/src/App.js << EOF
import React, { useState, useEffect } from 'react';

const API_URL = '${API_URL}';

function App() {
  const [insights, setInsights] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + 'insights');
      const data = await response.json();
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + 'watchlist');
      const data = await response.json();
      setWatchlist(data.watchlist || []);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInsights();
    fetchWatchlist();
  }, []);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ color: '#667eea' }}>🧬 CI Alert System</h1>
      <p style={{ color: '#666' }}>Pharmaceutical Competitive Intelligence Platform</p>
      
      <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '10px', margin: '20px 0' }}>
        <h2>📊 Insights ({insights.length})</h2>
        {loading ? <p>Loading...</p> : (
          insights.length === 0 ? <p>No insights yet. Trigger ingestion to fetch data.</p> : (
            <ul>
              {insights.map((insight, i) => (
                <li key={i}>{insight.molecule}: {insight.summary}</li>
              ))}
            </ul>
          )
        )}
      </div>

      <div style={{ background: '#fef3c7', padding: '20px', borderRadius: '10px', margin: '20px 0' }}>
        <h2>👁️ Watchlist ({watchlist.length})</h2>
        {watchlist.length === 0 ? <p>No molecules in watchlist.</p> : (
          <ul>
            {watchlist.map((item, i) => (
              <li key={i}>{item.molecule} - Added: {new Date(item.addedAt).toLocaleDateString()}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: '30px' }}>
        <button onClick={fetchInsights} style={{ padding: '10px 20px', margin: '5px', cursor: 'pointer' }}>
          🔄 Refresh Insights
        </button>
        <button onClick={fetchWatchlist} style={{ padding: '10px 20px', margin: '5px', cursor: 'pointer' }}>
          🔄 Refresh Watchlist
        </button>
      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: '#f8fafc', borderRadius: '10px' }}>
        <h3>System Info</h3>
        <p><strong>API URL:</strong> {API_URL}</p>
        <p><strong>User Pool:</strong> ${USER_POOL_ID}</p>
        <p><strong>Region:</strong> ${REGION}</p>
      </div>
    </div>
  );
}

export default App;
EOF

  echo "✅ Basic React app created"
fi

# Build frontend
echo "📦 Building React app..."
cd frontend

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

npm run build

cd ..

# Get S3 bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name CIAlert-Frontend \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Frontend stack not found. Deploy it first:"
  echo "   cd infrastructure && cdk deploy CIAlert-Frontend"
  exit 1
fi

# Upload to S3
echo "📤 Uploading to S3: $BUCKET_NAME"
aws s3 sync frontend/build/ s3://$BUCKET_NAME/ --delete

# Invalidate CloudFront cache
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name CIAlert-Frontend \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text)

if [ -n "$CLOUDFRONT_URL" ]; then
  DIST_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?DomainName=='${CLOUDFRONT_URL#https://}'].Id" \
    --output text)
  
  if [ -n "$DIST_ID" ]; then
    echo "🔄 Invalidating CloudFront cache..."
    aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" > /dev/null
  fi
fi

echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "🌐 CloudFront URL: $CLOUDFRONT_URL"
echo ""
echo "⏱️  Wait 2-3 minutes for CloudFront to update, then visit the URL"
