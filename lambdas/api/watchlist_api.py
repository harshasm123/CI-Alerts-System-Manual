import json
import os
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
lambda_client = boto3.client('lambda')

WATCHLIST_TABLE = os.environ['WATCHLIST_TABLE']
PUBMED_FUNCTION = os.environ.get('PUBMED_FUNCTION', '')
CLINICALTRIALS_FUNCTION = os.environ.get('CLINICALTRIALS_FUNCTION', '')
FDA_FUNCTION = os.environ.get('FDA_FUNCTION', '')

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
            
            # Trigger immediate ingestion for this molecule
            trigger_ingestion(molecule)
            
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': f'Added {molecule} to watchlist. Fetching data...'})
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

def trigger_ingestion(molecule):
    """Trigger ingestion functions for a specific molecule"""
    payload = json.dumps({'molecules': [molecule]})
    
    functions = [PUBMED_FUNCTION, CLINICALTRIALS_FUNCTION, FDA_FUNCTION]
    
    for function_name in functions:
        if function_name:
            try:
                lambda_client.invoke(
                    FunctionName=function_name,
                    InvocationType='Event',
                    Payload=payload
                )
                print(f"Triggered {function_name} for {molecule}")
            except Exception as e:
                print(f"Error triggering {function_name}: {str(e)}")
