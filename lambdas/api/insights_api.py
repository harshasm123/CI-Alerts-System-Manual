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
        
        # Format items for frontend
        formatted_items = []
        for item in items:
            formatted_items.append({
                'molecule': item.get('molecule', ''),
                'timestamp': item.get('timestamp', ''),
                'summary': item.get('insights', item.get('raw_content', 'No summary available'))[:500],
                'source': item.get('source', 'Unknown')
            })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'insights': formatted_items,
                'count': len(formatted_items)
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
