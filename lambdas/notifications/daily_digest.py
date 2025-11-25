import json
import os
import boto3
from datetime import datetime, timedelta
from typing import Dict, List, Any
from boto3.dynamodb.conditions import Key, Attr

# AWS clients
dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
bedrock = boto3.client('bedrock-runtime')

# Environment variables
INSIGHTS_TABLE = os.environ['INSIGHTS_TABLE']
USER_SETTINGS_TABLE = os.environ['USER_SETTINGS_TABLE']
WATCHLIST_TABLE = os.environ['WATCHLIST_TABLE']
REGION = os.environ['REGION']

# DynamoDB tables
insights_table = dynamodb.Table(INSIGHTS_TABLE)
user_settings_table = dynamodb.Table(USER_SETTINGS_TABLE)
watchlist_table = dynamodb.Table(WATCHLIST_TABLE)

def handler(event, context):
    """
    Generate and send daily digest emails to all users
    """
    try:
        # Get all users
        users = get_all_users()
        
        sent_count = 0
        error_count = 0
        
        for user in users:
            try:
                # Generate and send digest for user
                success = process_user_digest(user)
                if success:
                    sent_count += 1
                else:
                    error_count += 1
                    
            except Exception as e:
                print(f"Error processing user {user.get('user_id', 'unknown')}: {str(e)}")
                error_count += 1
                continue
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Daily digest completed',
                'sent_count': sent_count,
                'error_count': error_count,
                'total_users': len(users)
            })
        }
        
    except Exception as e:
        print(f"Error in daily digest: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def get_all_users() -> List[Dict[str, Any]]:
    """
    Get all users from user settings table
    """
    try:
        response = user_settings_table.scan()
        return response.get('Items', [])
    except Exception as e:
        print(f"Error getting users: {str(e)}")
        return []

def process_user_digest(user: Dict[str, Any]) -> bool:
    """
    Generate and send digest for a single user
    """
    try:
        user_id = user['user_id']
        email = user.get('email', '')
        
        if not email:
            print(f"No email for user {user_id}")
            return False
        
        # Get user's watchlist
        watchlist = get_user_watchlist(user_id)
        
        if not watchlist:
            print(f"No watchlist for user {user_id}")
            return True  # Not an error, just no molecules to track
        
        # Get insights for user's molecules from last 24 hours
        insights = get_user_insights(watchlist)
        
        if not insights:
            print(f"No insights for user {user_id}")
            return True  # Not an error, just no new insights
        
        # Generate digest content
        digest_content = generate_digest_content(insights, watchlist)
        
        # Send email
        return send_digest_email(email, digest_content, user.get('preferences', {}))
        
    except Exception as e:
        print(f"Error processing user digest: {str(e)}")
        return False

def get_user_watchlist(user_id: str) -> List[str]:
    """
    Get user's molecule watchlist
    """
    try:
        response = watchlist_table.query(
            KeyConditionExpression=Key('user_id').eq(user_id)
        )
        
        molecules = []
        for item in response.get('Items', []):
            molecules.append(item['molecule'])
        
        return molecules
        
    except Exception as e:
        print(f"Error getting watchlist for user {user_id}: {str(e)}")
        return []

def get_user_insights(molecules: List[str]) -> List[Dict[str, Any]]:
    """
    Get insights for user's molecules from last 24 hours
    """
    insights = []
    
    # Calculate time range (last 24 hours)
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=24)
    start_timestamp = start_time.isoformat()
    
    for molecule in molecules:
        try:
            # Query insights by molecule and timestamp
            response = insights_table.query(
                IndexName='molecule-timestamp-index',
                KeyConditionExpression=Key('molecule').eq(molecule) & Key('timestamp').gte(start_timestamp),
                ScanIndexForward=False,  # Most recent first
                Limit=10  # Limit per molecule
            )
            
            molecule_insights = response.get('Items', [])
            insights.extend(molecule_insights)
            
        except Exception as e:
            print(f"Error getting insights for molecule {molecule}: {str(e)}")
            continue
    
    # Sort by relevance score and timestamp
    insights.sort(key=lambda x: (x.get('relevance_score', 0), x.get('timestamp', '')), reverse=True)
    
    return insights[:20]  # Limit total insights

def generate_digest_content(insights: List[Dict[str, Any]], watchlist: List[str]) -> Dict[str, Any]:
    """
    Generate digest content using Bedrock AI
    """
    try:
        # Prepare insights summary for AI
        insights_text = ""
        for insight in insights:
            insights_text += f"""
Molecule: {insight.get('molecule', '')}
Source: {insight.get('source', '')}
Title: {insight.get('title', '')}
Summary: {insight.get('summary', '')}
Impact: {insight.get('impact_level', '')}
Relevance: {insight.get('relevance_score', 0)}
---
"""
        
        prompt = f"""
You are creating a daily competitive intelligence digest for a pharmaceutical professional.

Their watchlist includes: {', '.join(watchlist)}

Here are the latest insights from the past 24 hours:

{insights_text}

Please create a professional daily digest email with:
1. Executive Summary (2-3 sentences)
2. Key Highlights (top 3-5 most important items)
3. Molecule-specific updates (organized by molecule)
4. Competitive Intelligence Notes

Format as HTML email content. Be concise but informative.
Focus on actionable intelligence and competitive implications.
"""

        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            body=json.dumps(body)
        )
        
        response_body = json.loads(response['body'].read())
        html_content = response_body['content'][0]['text']
        
        # Generate subject line
        high_impact_count = len([i for i in insights if i.get('impact_level') == 'HIGH'])
        subject = f"CI Alert Daily Digest - {len(insights)} updates"
        if high_impact_count > 0:
            subject += f" ({high_impact_count} high impact)"
        
        return {
            'subject': subject,
            'html_content': html_content,
            'insights_count': len(insights),
            'molecules': list(set([i.get('molecule', '') for i in insights]))
        }
        
    except Exception as e:
        print(f"Error generating digest content: {str(e)}")
        # Fallback content
        return {
            'subject': f"CI Alert Daily Digest - {len(insights)} updates",
            'html_content': generate_fallback_content(insights, watchlist),
            'insights_count': len(insights),
            'molecules': list(set([i.get('molecule', '') for i in insights]))
        }

def generate_fallback_content(insights: List[Dict[str, Any]], watchlist: List[str]) -> str:
    """
    Generate fallback HTML content if AI generation fails
    """
    html = f"""
    <html>
    <body>
        <h2>Daily Competitive Intelligence Digest</h2>
        <p><strong>Date:</strong> {datetime.now().strftime('%Y-%m-%d')}</p>
        <p><strong>Your Watchlist:</strong> {', '.join(watchlist)}</p>
        
        <h3>Executive Summary</h3>
        <p>Found {len(insights)} new insights across your watched molecules in the past 24 hours.</p>
        
        <h3>Latest Updates</h3>
        <ul>
    """
    
    for insight in insights[:10]:  # Top 10
        html += f"""
        <li>
            <strong>{insight.get('molecule', 'Unknown')}</strong> - {insight.get('source', '')}
            <br>
            <em>{insight.get('title', '')}</em>
            <br>
            {insight.get('summary', '')}
            <br>
            <small>Impact: {insight.get('impact_level', '')} | Relevance: {insight.get('relevance_score', 0):.2f}</small>
            <br><br>
        </li>
        """
    
    html += """
        </ul>
        
        <p><small>This is an automated digest from the CI Alert System.</small></p>
    </body>
    </html>
    """
    
    return html

def send_digest_email(email: str, digest_content: Dict[str, Any], preferences: Dict[str, Any]) -> bool:
    """
    Send digest email via SES
    """
    try:
        # Check if user wants emails (default to True)
        if not preferences.get('email_enabled', True):
            return True
        
        response = ses.send_email(
            Source='noreply@ci-alert.com',  # Update with verified domain
            Destination={
                'ToAddresses': [email]
            },
            Message={
                'Subject': {
                    'Data': digest_content['subject'],
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Html': {
                        'Data': digest_content['html_content'],
                        'Charset': 'UTF-8'
                    }
                }
            }
        )
        
        print(f"Email sent successfully to {email}: {response['MessageId']}")
        return True
        
    except Exception as e:
        print(f"Error sending email to {email}: {str(e)}")
        return False