import json
import os
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')

INSIGHTS_TABLE = os.environ['INSIGHTS_TABLE']
WATCHLIST_TABLE = os.environ['WATCHLIST_TABLE']
USER_SETTINGS_TABLE = os.environ['USER_SETTINGS_TABLE']
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'noreply@example.com')

def lambda_handler(event, context):
    insights_table = dynamodb.Table(INSIGHTS_TABLE)
    watchlist_table = dynamodb.Table(WATCHLIST_TABLE)
    user_settings_table = dynamodb.Table(USER_SETTINGS_TABLE)
    
    # Get all users
    users_response = user_settings_table.scan()
    users = users_response.get('Items', [])
    
    # If no users in settings, get from watchlist
    if not users:
        watchlist_response = watchlist_table.scan()
        user_ids = set(item['userId'] for item in watchlist_response.get('Items', []))
        users = [{'userId': uid, 'email': uid} for uid in user_ids]
    
    yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
    
    for user in users:
        user_id = user['userId']
        email = user.get('email', user_id)
        
        # Get user's watchlist
        watchlist_response = watchlist_table.query(
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        molecules = [item['molecule'] for item in watchlist_response.get('Items', [])]
        
        if not molecules:
            continue
        
        # Get insights for user's molecules from last 24 hours
        user_insights = []
        for molecule in molecules:
            insights_response = insights_table.query(
                KeyConditionExpression=Key('molecule').eq(molecule) & Key('timestamp').gt(yesterday),
                ScanIndexForward=False,
                Limit=5
            )
            user_insights.extend(insights_response.get('Items', []))
        
        if not user_insights:
            continue
        
        # Generate email
        email_body = generate_email(user_id, molecules, user_insights)
        
        # Send via SES
        try:
            ses.send_email(
                Source=FROM_EMAIL,
                Destination={'ToAddresses': [email]},
                Message={
                    'Subject': {'Data': f'Daily CI Alert - {datetime.utcnow().strftime("%Y-%m-%d")}'},
                    'Body': {'Html': {'Data': email_body}}
                }
            )
            print(f"Sent digest to {email}")
        except Exception as e:
            print(f"Failed to send to {email}: {str(e)}")
    
    return {'statusCode': 200, 'body': json.dumps('Digests sent')}

def generate_email(user_id, molecules, insights):
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .header {{ background: #667eea; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            .insight {{ background: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #667eea; }}
            .molecule {{ color: #667eea; font-weight: bold; }}
            .timestamp {{ color: #999; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Daily Competitive Intelligence Alert</h1>
            <p>{datetime.utcnow().strftime("%B %d, %Y")}</p>
        </div>
        <div class="content">
            <h2>Hello {user_id},</h2>
            <p>Here are the latest insights for your watchlist: <strong>{', '.join(molecules)}</strong></p>
            
            <h3>Recent Insights ({len(insights)})</h3>
    """
    
    for insight in insights[:10]:
        molecule = insight.get('molecule', 'Unknown')
        timestamp = insight.get('timestamp', '')
        summary = insight.get('insights', insight.get('raw_content', 'No summary'))[:300]
        source = insight.get('source', 'Unknown')
        
        html += f"""
            <div class="insight">
                <div class="molecule">{molecule}</div>
                <div class="timestamp">{timestamp} | Source: {source}</div>
                <p>{summary}...</p>
            </div>
        """
    
    html += """
            <p>View full details in your <a href="#">CI Alert Dashboard</a></p>
        </div>
    </body>
    </html>
    """
    
    return html
