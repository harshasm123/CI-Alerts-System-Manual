import json
import os
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
bedrock = boto3.client('bedrock-runtime')

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
            try:
                # Query using GSI1 (molecule-timestamp index)
                insights_response = insights_table.query(
                    IndexName='GSI1',
                    KeyConditionExpression=Key('GSI1PK').eq(molecule) & Key('GSI1SK').gt(yesterday),
                    ScanIndexForward=False,
                    Limit=5
                )
                user_insights.extend(insights_response.get('Items', []))
            except Exception as e:
                print(f"Error querying insights for {molecule}: {str(e)}")
                # Fallback: scan with filter
                scan_response = insights_table.scan(
                    FilterExpression=Key('molecule').eq(molecule) & Key('timestamp').gt(yesterday),
                    Limit=5
                )
                user_insights.extend(scan_response.get('Items', []))
        
        if not user_insights:
            continue
        
        # Generate AI-powered email summary
        email_body = generate_ai_summary_email(user_id, molecules, user_insights)
        
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

def generate_ai_summary_email(user_id, molecules, insights):
    """Generate AI-powered email summary using Claude"""
    if not insights:
        return generate_fallback_email(user_id, molecules, [])
    
    # Prepare insights for AI summarization
    insights_text = ""
    for insight in insights[:10]:
        molecule = insight.get('molecule', 'Unknown')
        content = insight.get('insights', insight.get('raw_content', 'No content'))[:500]
        source = insight.get('source', 'Unknown')
        insights_text += f"\n\nMolecule: {molecule}\nSource: {source}\nContent: {content}"
    
    # Generate AI summary
    prompt = f"""Analyze these pharmaceutical competitive intelligence insights and create a concise executive summary for a daily digest email.

User's Watchlist: {', '.join(molecules)}
Insights from last 24 hours:
{insights_text}

Create a professional summary highlighting:
1. Key developments for each molecule
2. Competitive threats or opportunities
3. Regulatory updates
4. Market implications

Keep it concise (200-300 words) and actionable."""
    
    try:
        response = bedrock.invoke_model(
            modelId='anthropic.claude-3-5-haiku-20241022-v1:0',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 500,
                'messages': [{'role': 'user', 'content': prompt}]
            })
        )
        
        result = json.loads(response['body'].read())
        ai_summary = result['content'][0]['text']
        
        return generate_html_email(user_id, molecules, insights, ai_summary)
        
    except Exception as e:
        print(f"AI summarization failed: {str(e)}")
        return generate_fallback_email(user_id, molecules, insights)

def generate_html_email(user_id, molecules, insights, ai_summary):
    """Generate HTML email with AI summary"""
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .header {{ background: #667eea; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            .summary {{ background: #e8f4fd; padding: 20px; margin: 20px 0; border-radius: 8px; }}
            .insight {{ background: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #667eea; }}
            .molecule {{ color: #667eea; font-weight: bold; }}
            .timestamp {{ color: #999; font-size: 12px; }}
            .footer {{ background: #f8f9fa; padding: 15px; text-align: center; margin-top: 30px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🧬 Daily CI Alert</h1>
            <p>{datetime.utcnow().strftime("%B %d, %Y")}</p>
        </div>
        <div class="content">
            <h2>Hello {user_id},</h2>
            <p>Your watchlist: <strong>{', '.join(molecules)}</strong></p>
            
            <div class="summary">
                <h3>📊 Executive Summary</h3>
                <p>{ai_summary}</p>
            </div>
            
            <h3>📰 Recent Insights ({len(insights)})</h3>
    """
    
    for insight in insights[:5]:
        molecule = insight.get('molecule', 'Unknown')
        timestamp = insight.get('timestamp', '')[:19].replace('T', ' ')
        summary = insight.get('insights', insight.get('raw_content', 'No summary'))[:200]
        source = insight.get('source', 'Unknown')
        
        html += f"""
            <div class="insight">
                <div class="molecule">{molecule}</div>
                <div class="timestamp">{timestamp} | {source}</div>
                <p>{summary}...</p>
            </div>
        """
    
    html += f"""
            <div class="footer">
                <p>📱 <a href="#">View Full Dashboard</a> | 🔧 <a href="#">Manage Watchlist</a></p>
                <p><small>CI Alert System - Powered by AWS Bedrock</small></p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html

def generate_fallback_email(user_id, molecules, insights):
    """Fallback email without AI summary"""
    if not insights:
        return f"""
        <html><body>
        <h2>Daily CI Alert - {datetime.utcnow().strftime("%B %d, %Y")}</h2>
        <p>Hello {user_id},</p>
        <p>No new insights found for your watchlist: <strong>{', '.join(molecules)}</strong></p>
        <p>Check back tomorrow for updates!</p>
        </body></html>
        """
    
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
            <h1>🧬 Daily CI Alert</h1>
            <p>{datetime.utcnow().strftime("%B %d, %Y")}</p>
        </div>
        <div class="content">
            <h2>Hello {user_id},</h2>
            <p>Latest insights for: <strong>{', '.join(molecules)}</strong></p>
            
            <h3>📰 Recent Insights ({len(insights)})</h3>
    """
    
    for insight in insights[:5]:
        molecule = insight.get('molecule', 'Unknown')
        timestamp = insight.get('timestamp', '')[:19].replace('T', ' ')
        summary = insight.get('insights', insight.get('raw_content', 'No summary'))[:200]
        source = insight.get('source', 'Unknown')
        
        html += f"""
            <div class="insight">
                <div class="molecule">{molecule}</div>
                <div class="timestamp">{timestamp} | {source}</div>
                <p>{summary}...</p>
            </div>
        """
    
    html += """
            <p>📱 <a href="#">View Full Dashboard</a></p>
        </div>
    </body>
    </html>
    """
    
    return html
