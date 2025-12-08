import json
import os
import boto3
from datetime import datetime
from decimal import Decimal

# AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
USER_SETTINGS_TABLE = os.environ['USER_SETTINGS_TABLE']

# DynamoDB table
user_settings_table = dynamodb.Table(USER_SETTINGS_TABLE)

def handler(event, context):
    """
    Handle user settings API requests
    """
    try:
        http_method = event['httpMethod']
        
        # Extract user ID from JWT token
        user_id = extract_user_id(event)
        if not user_id:
            return {
                'statusCode': 401,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        if http_method == 'GET':
            return get_user_settings(user_id)
        elif http_method == 'PUT':
            return update_user_settings(user_id, event)
        else:
            return {
                'statusCode': 405,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Method not allowed'})
            }
            
    except Exception as e:
        print(f"Error in user settings API: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error'})
        }

def extract_user_id(event):
    """
    Extract user ID from Cognito JWT token
    """
    try:
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        return claims.get('sub')  # Cognito user ID
    except Exception as e:
        print(f"Error extracting user ID: {str(e)}")
        return None

def get_user_settings(user_id):
    """
    Get user settings
    """
    try:
        response = user_settings_table.get_item(
            Key={'userId': user_id}
        )
        
        if 'Item' in response:
            settings = response['Item']
        else:
            # Return default settings if user doesn't exist
            settings = get_default_settings(user_id)
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps(settings)
        }
        
    except Exception as e:
        print(f"Error getting user settings: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Failed to get user settings'})
        }

def update_user_settings(user_id, event):
    """
    Update user settings
    """
    try:
        body = json.loads(event.get('body', '{}'))
        
        # Get current settings or defaults
        try:
            current_response = user_settings_table.get_item(
                Key={'userId': user_id}
            )
            current_settings = current_response.get('Item', get_default_settings(user_id))
        except Exception:
            current_settings = get_default_settings(user_id)
        
        # Update settings with provided values
        updated_settings = current_settings.copy()
        
        # Update email if provided
        if 'email' in body:
            updated_settings['email'] = body['email']
        
        # Update alert time if provided
        if 'alert_time' in body:
            alert_time = body['alert_time']
            if validate_time_format(alert_time):
                updated_settings['alert_time'] = alert_time
            else:
                return {
                    'statusCode': 400,
                    'headers': get_cors_headers(),
                    'body': json.dumps({'error': 'Invalid alert_time format. Use HH:MM'})
                }
        
        # Update timezone if provided
        if 'timezone' in body:
            updated_settings['timezone'] = body['timezone']
        
        # Update preferences if provided
        if 'preferences' in body:
            preferences = body['preferences']
            current_prefs = updated_settings.get('preferences', {})
            
            # Update individual preference fields
            if 'email_enabled' in preferences:
                current_prefs['email_enabled'] = bool(preferences['email_enabled'])
            
            if 'min_relevance' in preferences:
                min_rel = float(preferences['min_relevance'])
                if 0.0 <= min_rel <= 1.0:
                    current_prefs['min_relevance'] = Decimal(str(min_rel))
                else:
                    return {
                        'statusCode': 400,
                        'headers': get_cors_headers(),
                        'body': json.dumps({'error': 'min_relevance must be between 0.0 and 1.0'})
                    }
            
            if 'sources' in preferences:
                valid_sources = ['PubMed', 'ClinicalTrials.gov', 'FDA', 'EMA', 'WIPO']
                sources = preferences['sources']
                if isinstance(sources, list) and all(s in valid_sources for s in sources):
                    current_prefs['sources'] = sources
                else:
                    return {
                        'statusCode': 400,
                        'headers': get_cors_headers(),
                        'body': json.dumps({
                            'error': f'Invalid sources. Valid options: {valid_sources}'
                        })
                    }
            
            if 'impact_levels' in preferences:
                valid_levels = ['HIGH', 'MEDIUM', 'LOW']
                levels = preferences['impact_levels']
                if isinstance(levels, list) and all(l in valid_levels for l in levels):
                    current_prefs['impact_levels'] = levels
                else:
                    return {
                        'statusCode': 400,
                        'headers': get_cors_headers(),
                        'body': json.dumps({
                            'error': f'Invalid impact_levels. Valid options: {valid_levels}'
                        })
                    }
            
            updated_settings['preferences'] = current_prefs
        
        # Update timestamps
        updated_settings['updated_at'] = datetime.now().isoformat()
        if 'created_at' not in updated_settings:
            updated_settings['created_at'] = updated_settings['updated_at']
        
        # Save to DynamoDB
        user_settings_table.put_item(Item=updated_settings)
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'message': 'Settings updated successfully',
                'settings': updated_settings
            })
        }
        
    except Exception as e:
        print(f"Error updating user settings: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Failed to update settings'})
        }

def get_default_settings(user_id):
    """
    Get default user settings
    """
    return {
        'userId': user_id,
        'email': '',
        'alert_time': '09:00',
        'timezone': 'UTC',
        'preferences': {
            'email_enabled': True,
            'min_relevance': Decimal('0.5'),
            'sources': ['PubMed', 'ClinicalTrials.gov', 'FDA', 'EMA', 'WIPO'],
            'impact_levels': ['HIGH', 'MEDIUM', 'LOW']
        },
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }

def validate_time_format(time_str):
    """
    Validate time format (HH:MM)
    """
    try:
        parts = time_str.split(':')
        if len(parts) != 2:
            return False
        
        hour = int(parts[0])
        minute = int(parts[1])
        
        return 0 <= hour <= 23 and 0 <= minute <= 59
    except Exception:
        return False

def get_cors_headers():
    """
    Get CORS headers for API responses
    """
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
        'Content-Type': 'application/json'
    }