import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
INSIGHTS_TABLE = os.environ['INSIGHTS_TABLE']
table = dynamodb.Table(INSIGHTS_TABLE)

def lambda_handler(event, context):
    params = event.get('queryStringParameters', {}) or {}
    molecule = params.get('molecule')
    limit = int(params.get('limit', 10))
    
    try:
        if molecule:
            # Get insights for specific molecule
            response = table.query(
                KeyConditionExpression=Key('molecule').eq(molecule),
                ScanIndexForward=False,  # Sort by timestamp descending
                Limit=limit
            )
        else:
            # Get recent insights across all molecules
            response = table.scan(Limit=limit)
        
        items = response.get('Items', [])
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'insights': items,
                'count': len(items)
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
