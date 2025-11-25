import json
import os
import boto3
from datetime import datetime
from boto3.dynamodb.conditions import Key

# AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
WATCHLIST_TABLE = os.environ['WATCHLIST_TABLE']

# DynamoDB table
watchlist_table = dynamodb.Table(WATCHLIST_TABLE)

def handler(event, context):
    """
    Handle watchlist API requests
    """
    try:
        http_method = event['httpMethod']
        path_parameters = event.get('pathParameters') or {}
        
        # Extract user ID from JWT token
        user_id = extract_user_id(event)
        if not user_id:
            return {
                'statusCode': 401,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        if http_method == 'GET':
            return get_watchlist(user_id)
        elif http_method == 'POST':
            return add_to_watchlist(user_id, event)
        elif http_method == 'DELETE':
            molecule = path_parameters.get('molecule')
            return remove_from_watchlist(user_id, molecule)
        else:
            return {
                'statusCode': 405,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Method not allowed'})
            }
            
    except Exception as e:
        print(f"Error in watchlist API: {str(e)}")
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

def get_watchlist(user_id):
    """
    Get user's watchlist
    """
    try:
        response = watchlist_table.query(
            KeyConditionExpression=Key('user_id').eq(user_id)
        )
        
        molecules = []
        for item in response.get('Items', []):
            molecules.append({
                'molecule': item['molecule'],
                'created_at': item.get('created_at', ''),
                'aliases': item.get('aliases', [])
            })
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'molecules': molecules,
                'count': len(molecules)
            })
        }
        
    except Exception as e:
        print(f"Error getting watchlist: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Failed to get watchlist'})
        }

def add_to_watchlist(user_id, event):
    """
    Add molecule to user's watchlist
    """
    try:
        body = json.loads(event.get('body', '{}'))
        molecule = body.get('molecule', '').strip().lower()
        aliases = body.get('aliases', [])
        
        if not molecule:
            return {
                'statusCode': 400,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Molecule name is required'})
            }
        
        # Check if molecule already exists
        try:
            existing = watchlist_table.get_item(
                Key={'user_id': user_id, 'molecule': molecule}
            )
            if 'Item' in existing:
                return {
                    'statusCode': 409,
                    'headers': get_cors_headers(),
                    'body': json.dumps({'error': 'Molecule already in watchlist'})
                }
        except Exception:
            pass  # Item doesn't exist, which is fine
        
        # Add to watchlist
        item = {
            'user_id': user_id,
            'molecule': molecule,
            'created_at': datetime.now().isoformat(),
            'aliases': aliases
        }
        
        watchlist_table.put_item(Item=item)
        
        return {
            'statusCode': 201,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'message': 'Molecule added to watchlist',
                'molecule': molecule
            })
        }
        
    except Exception as e:
        print(f"Error adding to watchlist: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Failed to add molecule'})
        }

def remove_from_watchlist(user_id, molecule):
    """
    Remove molecule from user's watchlist
    """
    try:
        if not molecule:
            return {
                'statusCode': 400,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Molecule name is required'})
            }
        
        molecule = molecule.strip().lower()
        
        # Remove from watchlist
        watchlist_table.delete_item(
            Key={'user_id': user_id, 'molecule': molecule}
        )
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'message': 'Molecule removed from watchlist',
                'molecule': molecule
            })
        }
        
    except Exception as e:
        print(f"Error removing from watchlist: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Failed to remove molecule'})
        }

def get_cors_headers():
    """
    Get CORS headers for API responses
    """
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Content-Type': 'application/json'
    }