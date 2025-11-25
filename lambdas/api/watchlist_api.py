import json
import os
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
WATCHLIST_TABLE = os.environ['WATCHLIST_TABLE']
table = dynamodb.Table(WATCHLIST_TABLE)

def lambda_handler(event, context):
    http_method = event['httpMethod']
    
    # Extract userId from authorizer or query params
    user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub', 'test-user')
    
    try:
        if http_method == 'GET':
            # Get user's watchlist
            response = table.query(
                KeyConditionExpression='userId = :uid',
                ExpressionAttributeValues={':uid': user_id}
            )
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'watchlist': response.get('Items', [])})
            }
            
        elif http_method == 'POST':
            # Add molecule to watchlist
            body = json.loads(event['body'])
            molecule = body['molecule']
            
            table.put_item(Item={
                'userId': user_id,
                'molecule': molecule,
                'addedAt': datetime.utcnow().isoformat(),
                'notifications': body.get('notifications', True)
            })
            
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': f'Added {molecule} to watchlist'})
            }
            
        elif http_method == 'DELETE':
            # Remove molecule from watchlist
            params = event.get('queryStringParameters', {})
            molecule = params.get('molecule')
            
            if not molecule:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'molecule parameter required'})
                }
            
            table.delete_item(Key={'userId': user_id, 'molecule': molecule})
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': f'Removed {molecule} from watchlist'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
