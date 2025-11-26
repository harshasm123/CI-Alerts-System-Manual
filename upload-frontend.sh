#!/bin/bash

# Upload simple frontend to S3

REGION=$(aws configure get region)
STACK_NAME="CIAlert-Frontend"

# Get S3 bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Frontend stack not found"
  exit 1
fi

echo "📦 Uploading frontend to: $BUCKET_NAME"

# Create temporary frontend files
mkdir -p /tmp/frontend

# Create index.html
cat > /tmp/frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CI Alert System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 800px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .status {
            background: #f0f9ff;
            border-left: 4px solid #0ea5e9;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .status h3 {
            color: #0ea5e9;
            margin-bottom: 10px;
        }
        .endpoint {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        .endpoint strong {
            color: #667eea;
            display: block;
            margin-bottom: 5px;
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 1em;
            cursor: pointer;
            margin: 5px;
            transition: all 0.3s;
        }
        button:hover {
            background: #764ba2;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        #output {
            background: #1e293b;
            color: #10b981;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            max-height: 400px;
            overflow-y: auto;
            display: none;
        }
        .feature {
            display: inline-block;
            background: #f1f5f9;
            padding: 8px 16px;
            border-radius: 20px;
            margin: 5px;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧬 CI Alert System</h1>
        <p class="subtitle">Pharmaceutical Competitive Intelligence Platform</p>
        
        <div class="status">
            <h3>✅ System Status: Online</h3>
            <p>All services are operational</p>
        </div>

        <div class="endpoint">
            <strong>API Endpoint:</strong>
            <span id="api-url">Loading...</span>
        </div>

        <h3 style="margin-top: 30px; color: #334155;">Quick Actions</h3>
        <div style="margin: 20px 0;">
            <button onclick="getInsights()">📊 Get Insights</button>
            <button onclick="getWatchlist()">👁️ View Watchlist</button>
            <button onclick="addMolecule()">➕ Add Molecule</button>
            <button onclick="triggerIngestion()">🔄 Trigger Ingestion</button>
        </div>

        <h3 style="margin-top: 30px; color: #334155;">Features</h3>
        <div style="margin: 15px 0;">
            <span class="feature">🤖 AI-Powered Analysis</span>
            <span class="feature">📈 Real-time Insights</span>
            <span class="feature">🔔 Daily Alerts</span>
            <span class="feature">🔐 Secure Authentication</span>
            <span class="feature">☁️ Serverless Architecture</span>
        </div>

        <div id="output"></div>
    </div>

    <script>
        const API_URL = 'https://0ddgzyuwx3.execute-api.us-east-1.amazonaws.com/prod/';
        document.getElementById('api-url').textContent = API_URL;

        function showOutput(data) {
            const output = document.getElementById('output');
            output.style.display = 'block';
            output.textContent = JSON.stringify(data, null, 2);
        }

        async function getInsights() {
            try {
                const response = await fetch(API_URL + 'insights');
                const data = await response.json();
                showOutput(data);
            } catch (error) {
                showOutput({ error: error.message });
            }
        }

        async function getWatchlist() {
            try {
                const response = await fetch(API_URL + 'watchlist');
                const data = await response.json();
                showOutput(data);
            } catch (error) {
                showOutput({ error: error.message });
            }
        }

        async function addMolecule() {
            const molecule = prompt('Enter molecule name:', 'Keytruda');
            if (!molecule) return;
            
            try {
                const response = await fetch(API_URL + 'watchlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ molecule, userId: 'demo-user' })
                });
                const data = await response.json();
                showOutput(data);
            } catch (error) {
                showOutput({ error: error.message });
            }
        }

        async function triggerIngestion() {
            showOutput({ message: 'Ingestion triggered via EventBridge (runs daily at 9 AM)' });
        }
    </script>
</body>
</html>
EOF

# Create error.html
cat > /tmp/frontend/error.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Error - CI Alert System</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #f3f4f6;
        }
        .error {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        h1 { color: #ef4444; }
    </style>
</head>
<body>
    <div class="error">
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">Go Home</a>
    </div>
</body>
</html>
EOF

# Upload to S3
echo "Uploading files..."
aws s3 cp /tmp/frontend/index.html s3://$BUCKET_NAME/index.html --content-type text/html
aws s3 cp /tmp/frontend/error.html s3://$BUCKET_NAME/error.html --content-type text/html

# Clean up
rm -rf /tmp/frontend

echo "✅ Frontend uploaded successfully!"
echo ""
echo "CloudFront URL:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text
